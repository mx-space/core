import { createHash, createHmac } from 'node:crypto'
import path from 'node:path'
import { Readable } from 'node:stream'

import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { extension } from 'mime-types'

import { BizException } from '~/common/exceptions/biz.exception'
import { EventScope } from '~/constants/business-event.constant'
import { CollectionRefTypes } from '~/constants/db.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { EventBusEvents } from '~/constants/event-bus.constant'
import type { IConfig } from '~/modules/configs/configs.interface'
import type { AIConfig } from '~/modules/configs/configs.schema'
import { ConfigsService } from '~/modules/configs/configs.service'
import { FileService } from '~/modules/file/file.service'
import { FileReferenceType } from '~/modules/file/file-reference.model'
import { FileReferenceService } from '~/modules/file/file-reference.service'
import { DatabaseService } from '~/processors/database/database.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { HttpService } from '~/processors/helper/helper.http.service'
import {
  type TaskExecuteContext,
  TaskQueueProcessor,
} from '~/processors/task-queue'
import { extractTextFromContent } from '~/utils/content.util'
import { dbTransforms } from '~/utils/db-transform.util'
import {
  generateFilename,
  generateFilePath,
  replaceFilenameTemplate,
} from '~/utils/filename-template.util'
import { S3Uploader } from '~/utils/s3.util'
import { sleep } from '~/utils/tool.util'

import { AITaskType, type CoverTaskPayload } from '../ai-task/ai-task.types'
import { AiWriterService } from '../ai-writer/ai-writer.service'

type JimengOptions = NonNullable<AIConfig['jimengOptions']>
type ResolvedJimengOptions = JimengOptions & {
  accessKeyId: string
  secretAccessKey: string
}

type SupportedArticleType =
  | CollectionRefTypes.Post
  | CollectionRefTypes.Note
  | CollectionRefTypes.Page

interface ResolvedArticle {
  type: SupportedArticleType
  document: {
    id: string
    title: string
    text: string
    subtitle?: string | null
    summary?: string | null
    tags?: string[]
    contentFormat?: string
    content?: string
    meta?: Record<string, any> | string | null
  }
  meta: Record<string, any>
}

interface StoredImage {
  url: string
  storage: 's3' | 'local'
  name: string
}

@Injectable()
export class AiImageService implements OnModuleInit {
  private readonly logger = new Logger(AiImageService.name)

  constructor(
    private readonly configService: ConfigsService,
    private readonly aiWriterService: AiWriterService,
    private readonly databaseService: DatabaseService,
    private readonly fileService: FileService,
    private readonly fileReferenceService: FileReferenceService,
    private readonly httpService: HttpService,
    private readonly eventManager: EventManagerService,
    private readonly taskProcessor: TaskQueueProcessor,
  ) {}

  onModuleInit() {
    this.taskProcessor.registerHandler({
      type: AITaskType.Cover,
      execute: async (
        payload: CoverTaskPayload,
        context: TaskExecuteContext,
      ) => {
        await context.updateProgress(0, 'Preparing cover generation')
        const result = await this.generateCoverForArticle(payload, context)
        await context.setResult(result)
      },
    })

    this.logger.log('AI cover task handler registered')
  }

  private async generateCoverForArticle(
    payload: CoverTaskPayload,
    context: TaskExecuteContext,
  ) {
    const config = await this.resolveJimengConfig()
    const article = await this.resolveArticle(payload.refId)

    if (article.meta.cover && !payload.overwrite) {
      await context.appendLog(
        'info',
        `Cover already exists for article=${payload.refId}, skip generation`,
      )
      await context.updateProgress(100, 'Skipped: cover already exists')
      return {
        skipped: true,
        reason: 'cover_exists',
        articleId: payload.refId,
        coverUrl: article.meta.cover,
      }
    }

    const targetAspect = this.resolveTargetAspect(config)
    await context.updateProgress(10, 'Generating cover prompt')

    const promptResult = await this.aiWriterService.generateCoverPromptByOpenAI(
      {
        title: article.document.title,
        subtitle: article.document.subtitle,
        summary: article.document.summary,
        tags: Array.isArray(article.document.tags)
          ? article.document.tags
          : undefined,
        text: this.buildPromptSource(article.document),
        targetAspect,
      },
    )
    await context.incrementTokens(promptResult.usage?.totalTokens)

    const prompt = promptResult.prompt.slice(0, 1200)
    await context.appendLog('info', `Prompt generated (${prompt.length} chars)`)

    await context.updateProgress(35, 'Submitting JiMeng generation task')
    const generated = await this.generateImageWithJimeng(
      prompt,
      config,
      context,
    )

    await context.updateProgress(70, 'Downloading generated image')
    const { buffer, contentType } = await this.downloadGeneratedImage(
      generated.imageUrl,
    )

    await context.updateProgress(85, 'Uploading generated image')
    const stored = await this.storeGeneratedImage(
      buffer,
      contentType,
      article.document.id,
    )

    await context.updateProgress(95, 'Writing cover URL back to article')
    await this.writeBackArticleCover(article, stored.url)

    await context.updateProgress(100, 'Cover generation completed')
    return {
      articleId: article.document.id,
      coverUrl: stored.url,
      sourceImageUrl: generated.imageUrl,
      prompt,
      storage: stored.storage,
      requestId: generated.requestId,
    }
  }

  private async resolveJimengConfig(): Promise<ResolvedJimengOptions> {
    const aiConfig = await this.configService.get('ai')
    const config = aiConfig.jimengOptions

    if (
      !aiConfig.enableCoverGeneration ||
      !config?.accessKeyId ||
      !config.secretAccessKey
    ) {
      throw new BizException(
        ErrorCodeEnum.AINotEnabled,
        'AI cover generation is not configured',
      )
    }

    return config as ResolvedJimengOptions
  }

  private async resolveArticle(articleId: string): Promise<ResolvedArticle> {
    const article = await this.databaseService.findGlobalById(articleId)

    if (!article?.document) {
      throw new BizException(ErrorCodeEnum.ContentNotFoundCantProcess)
    }

    if (article.type === CollectionRefTypes.Recently) {
      throw new BizException(ErrorCodeEnum.ContentNotFoundCantProcess)
    }

    return {
      type: article.type as SupportedArticleType,
      document: article.document as ResolvedArticle['document'],
      meta: this.normalizeMeta(
        (article.document as ResolvedArticle['document']).meta,
      ),
    }
  }

  private normalizeMeta(
    meta: ResolvedArticle['document']['meta'],
  ): Record<string, any> {
    if (!meta) {
      return {}
    }

    if (typeof meta === 'string') {
      return (JSON.safeParse(meta) as Record<string, any>) || {}
    }

    return meta
  }

  private buildPromptSource(document: ResolvedArticle['document']): string {
    const extracted = extractTextFromContent({
      text: document.text,
      contentFormat: document.contentFormat as any,
      content: document.content,
    })
      .replaceAll(/\s+/g, ' ')
      .trim()

    const source = extracted || document.text || document.title
    return source.slice(0, 6000)
  }

  private resolveTargetAspect(
    config: Pick<JimengOptions, 'width' | 'height'>,
  ): 'landscape' | 'portrait' | 'square' {
    const width = config.width || 1664
    const height = config.height || 936

    if (width === height) {
      return 'square'
    }

    return width > height ? 'landscape' : 'portrait'
  }

  private async generateImageWithJimeng(
    prompt: string,
    config: ResolvedJimengOptions,
    context: TaskExecuteContext,
  ): Promise<{ imageUrl: string; requestId?: string }> {
    const submitBody = {
      req_key: config.reqKey || 'jimeng_t2i_v30',
      prompt,
      seed: config.seed ?? -1,
      ...(config.width && config.height
        ? {
            width: config.width,
            height: config.height,
          }
        : {}),
      return_url: config.returnUrl ?? true,
      use_pre_llm: config.usePreLlm ?? false,
    }

    const submitResponse = await this.signedVisualPost(
      'CVSync2AsyncSubmitTask',
      submitBody,
      config,
    )

    if (submitResponse.code !== 10000) {
      throw new BizException(
        ErrorCodeEnum.AIException,
        submitResponse.message || 'JiMeng submit failed',
      )
    }

    const taskId = submitResponse?.data?.task_id || submitResponse?.data?.taskId

    if (!taskId) {
      throw new BizException(
        ErrorCodeEnum.AIException,
        'JiMeng task id is missing',
      )
    }

    await context.appendLog('info', `JiMeng task submitted: ${taskId}`)

    const pollStartedAt = Date.now()
    const pollInterval = config.pollIntervalMs || 3000
    const pollTimeout = config.pollTimeoutMs || 120000
    const queryOptions = {
      return_url: config.returnUrl ?? true,
    }

    while (Date.now() - pollStartedAt < pollTimeout) {
      if (context.isAborted()) {
        throw new Error('Cover generation task aborted')
      }

      const queryResponse = await this.signedVisualPost(
        'CVSync2AsyncGetResult',
        {
          req_key: config.reqKey || 'jimeng_t2i_v30',
          task_id: taskId,
          req_json: JSON.stringify(queryOptions),
        },
        config,
      )

      if (queryResponse.code !== 10000) {
        throw new BizException(
          ErrorCodeEnum.AIException,
          queryResponse.message || 'JiMeng query failed',
        )
      }

      const status = queryResponse?.data?.status

      if (status === 'done') {
        const imageUrl = queryResponse?.data?.image_urls?.[0]
        const binaryBase64 = queryResponse?.data?.binary_data_base64?.[0]

        if (imageUrl) {
          return {
            imageUrl,
            requestId: queryResponse.request_id,
          }
        }

        if (binaryBase64) {
          return {
            imageUrl: `data:image/png;base64,${binaryBase64}`,
            requestId: queryResponse.request_id,
          }
        }

        throw new BizException(
          ErrorCodeEnum.AIException,
          'JiMeng finished without image output',
        )
      }

      if (status === 'not_found' || status === 'expired') {
        throw new BizException(
          ErrorCodeEnum.AIException,
          `JiMeng task status: ${status}`,
        )
      }

      await sleep(pollInterval)
    }

    throw new BizException(
      ErrorCodeEnum.AIException,
      'JiMeng polling timed out',
    )
  }

  private async signedVisualPost(
    action: 'CVSync2AsyncSubmitTask' | 'CVSync2AsyncGetResult',
    body: Record<string, unknown>,
    config: ResolvedJimengOptions,
  ): Promise<any> {
    const url = new URL('https://visual.volcengineapi.com/')
    const query = {
      Action: action,
      Version: '2022-08-31',
    }
    Object.entries(query).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })

    const payload = JSON.stringify(body)
    const xDate = this.formatUtcDate(new Date())
    const payloadHash = this.sha256Hex(payload)
    const headers = {
      'content-type': 'application/json',
      host: url.host,
      'x-content-sha256': payloadHash,
      'x-date': xDate,
    }

    const signedHeaders = Object.keys(headers).sort().join(';')
    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map((key) => `${key}:${headers[key as keyof typeof headers].trim()}\n`)
      .join('')

    const canonicalRequest = [
      'POST',
      url.pathname || '/',
      this.buildCanonicalQueryString(query),
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n')

    const shortDate = xDate.slice(0, 8)
    const credentialScope = `${shortDate}/cn-north-1/cv/request`
    const stringToSign = [
      'HMAC-SHA256',
      xDate,
      credentialScope,
      this.sha256Hex(canonicalRequest),
    ].join('\n')

    const signingKey = this.buildVolcengineSigningKey(
      config.secretAccessKey,
      shortDate,
      'cn-north-1',
      'cv',
    )
    const signature = createHmac('sha256', signingKey)
      .update(stringToSign)
      .digest('hex')

    const authorization = `HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Content-Sha256': payloadHash,
        'X-Date': xDate,
        Authorization: authorization,
      },
      body: payload,
    })

    if (!response.ok) {
      const text = await response.text()
      throw new BizException(
        ErrorCodeEnum.AIException,
        `JiMeng HTTP ${response.status}: ${text}`,
      )
    }

    return await response.json()
  }

  private buildVolcengineSigningKey(
    secretAccessKey: string,
    shortDate: string,
    region: string,
    service: string,
  ): Buffer {
    const kDate = createHmac('sha256', secretAccessKey)
      .update(shortDate)
      .digest()
    const kRegion = createHmac('sha256', kDate).update(region).digest()
    const kService = createHmac('sha256', kRegion).update(service).digest()
    return createHmac('sha256', kService).update('request').digest()
  }

  private buildCanonicalQueryString(query: Record<string, string>): string {
    return Object.entries(query)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([key, value]) =>
          `${this.rfc3986Encode(key)}=${this.rfc3986Encode(value)}`,
      )
      .join('&')
  }

  private rfc3986Encode(value: string) {
    return encodeURIComponent(value).replaceAll(
      /[!'()*]/g,
      (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
    )
  }

  private formatUtcDate(date: Date): string {
    return date.toISOString().replaceAll(/[:-]|\.\d{3}/g, '')
  }

  private sha256Hex(value: string | Buffer): string {
    return createHash('sha256').update(value).digest('hex')
  }

  private async downloadGeneratedImage(sourceUrl: string): Promise<{
    buffer: Buffer
    contentType: string
  }> {
    if (sourceUrl.startsWith('data:')) {
      const [prefix, rawBase64] = sourceUrl.split(',', 2)
      const mime = prefix.match(/^data:(.*?);base64$/)?.[1] || 'image/png'
      return {
        buffer: Buffer.from(rawBase64, 'base64'),
        contentType: mime,
      }
    }

    const response = await this.httpService.axiosRef.get<ArrayBuffer>(
      sourceUrl,
      {
        responseType: 'arraybuffer',
      },
    )

    const contentType = response.headers['content-type'] || 'image/png'

    return {
      buffer: Buffer.from(response.data),
      contentType,
    }
  }

  private async storeGeneratedImage(
    buffer: Buffer,
    contentType: string,
    articleId: string,
  ): Promise<StoredImage> {
    const uploadConfig = await this.configService.get('fileUploadOptions')
    const imageStorageConfig = await this.configService.get(
      'imageStorageOptions',
    )

    const ext = extension(contentType) || 'png'
    const originalFilename = `ai-cover-${articleId}.${ext}`

    if (this.canUseS3Storage(imageStorageConfig)) {
      const filename = generateFilename(uploadConfig, {
        originalFilename,
        fileType: 'image',
      })

      let prefixPath = ''
      if (imageStorageConfig.prefix) {
        prefixPath = replaceFilenameTemplate(imageStorageConfig.prefix, {
          originalFilename,
          fileType: 'image',
        }).replace(/\/+$/, '')
      }

      const objectKey = prefixPath ? `${prefixPath}/${filename}` : filename
      const uploader = new S3Uploader({
        endpoint: imageStorageConfig.endpoint,
        accessKey: imageStorageConfig.secretId,
        secretKey: imageStorageConfig.secretKey,
        bucket: imageStorageConfig.bucket,
        region: imageStorageConfig.region || 'auto',
      })

      if (imageStorageConfig.customDomain) {
        uploader.setCustomDomain(imageStorageConfig.customDomain)
      }

      const url = await uploader.uploadBuffer(buffer, objectKey, contentType)
      await this.fileReferenceService.createPendingReference(
        url,
        filename,
        objectKey,
      )

      return {
        url,
        storage: 's3',
        name: filename,
      }
    }

    const rawFilename = generateFilename(uploadConfig, {
      originalFilename,
      fileType: 'image',
    })
    const basePath = generateFilePath(uploadConfig, {
      originalFilename,
      fileType: 'image',
    })

    const relativePath =
      basePath === 'image' || !basePath
        ? rawFilename
        : path.join(
            basePath.startsWith('image/') ? basePath.slice(6) : basePath,
            rawFilename,
          )

    await this.fileService.writeFile(
      'image',
      relativePath,
      Readable.from([buffer]),
    )
    const url = await this.fileService.resolveFileUrl('image', relativePath)

    await this.fileReferenceService.createPendingReference(url, relativePath)

    return {
      url,
      storage: 'local',
      name: path.basename(relativePath),
    }
  }

  private canUseS3Storage(
    imageStorageConfig: IConfig['imageStorageOptions'],
  ): imageStorageConfig is IConfig['imageStorageOptions'] & {
    endpoint: string
    secretId: string
    secretKey: string
    bucket: string
  } {
    return Boolean(
      imageStorageConfig.enable &&
      imageStorageConfig.endpoint &&
      imageStorageConfig.secretId &&
      imageStorageConfig.secretKey &&
      imageStorageConfig.bucket,
    )
  }

  private async writeBackArticleCover(
    article: ResolvedArticle,
    coverUrl: string,
  ): Promise<void> {
    const model = this.databaseService.getModelByRefType(article.type) as any
    const meta = {
      ...article.meta,
      cover: coverUrl,
    }

    await model
      .updateOne(
        { _id: article.document.id },
        {
          $set: {
            meta: dbTransforms.json(meta),
          },
        },
      )
      .exec()

    await this.fileReferenceService.updateReferencesForDocument(
      {
        ...article.document,
        meta,
      },
      article.document.id,
      this.mapFileReferenceType(article.type),
    )

    await this.eventManager.emit(EventBusEvents.CleanAggregateCache, null, {
      scope: EventScope.TO_SYSTEM,
    })
  }

  private mapFileReferenceType(type: SupportedArticleType): FileReferenceType {
    switch (type) {
      case CollectionRefTypes.Post: {
        return FileReferenceType.Post
      }
      case CollectionRefTypes.Note: {
        return FileReferenceType.Note
      }
      case CollectionRefTypes.Page: {
        return FileReferenceType.Page
      }
    }

    throw new BizException(ErrorCodeEnum.ContentNotFoundCantProcess)
  }
}
