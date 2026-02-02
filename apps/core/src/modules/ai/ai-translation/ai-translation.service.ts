import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { BizException } from '~/common/exceptions/biz.exception'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { CollectionRefTypes } from '~/constants/db.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { DatabaseService } from '~/processors/database/database.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import {
  TaskQueueProcessor,
  TaskQueueService,
  TaskStatus,
  type TaskExecuteContext,
} from '~/processors/task-queue'
import { InjectModel } from '~/transformers/model.transformer'
import { scheduleManager } from '~/utils/schedule.util'
import { md5 } from '~/utils/tool.util'
import dayjs from 'dayjs'
import removeMdCodeblock from 'remove-md-codeblock'
import { ConfigsService } from '../../configs/configs.service'
import type { NoteModel } from '../../note/note.model'
import type { PageModel } from '../../page/page.model'
import type { PostModel } from '../../post/post.model'
import { AiInFlightService } from '../ai-inflight/ai-inflight.service'
import type { AiStreamEvent } from '../ai-inflight/ai-inflight.types'
import {
  AITaskType,
  computeAITaskDedupKey,
  type TranslationAllTaskPayload,
  type TranslationBatchTaskPayload,
  type TranslationTaskPayload,
} from '../ai-task/ai-task.types'
import {
  AI_STREAM_IDLE_TIMEOUT_MS,
  AI_STREAM_LOCK_TTL,
  AI_STREAM_MAXLEN,
  AI_STREAM_READ_BLOCK_MS,
  AI_STREAM_RESULT_TTL,
} from '../ai.constants'
import { AI_PROMPTS } from '../ai.prompts'
import { AiService } from '../ai.service'
import { AITranslationModel } from './ai-translation.model'
import type { GetTranslationsGroupedQueryInput } from './ai-translation.schema'

interface ArticleContent {
  title: string
  text: string
  summary?: string | null
  tags?: string[]
  meta?: { lang?: string }
}

type ArticleDocument = PostModel | NoteModel | PageModel

type ArticleEventDocument = ArticleDocument & {
  _id?: { toString?: () => string } | string
}

type ArticleEventPayload = ArticleEventDocument | { data: string }

type GlobalArticle =
  | { document: PostModel; type: CollectionRefTypes.Post }
  | { document: NoteModel; type: CollectionRefTypes.Note }
  | { document: PageModel; type: CollectionRefTypes.Page }
  | {
      document: unknown
      type: CollectionRefTypes.Recently
    }

@Injectable()
export class AiTranslationService implements OnModuleInit {
  private readonly logger = new Logger(AiTranslationService.name)

  constructor(
    @InjectModel(AITranslationModel)
    private readonly aiTranslationModel: MongooseModel<AITranslationModel>,
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigsService,
    private readonly aiService: AiService,
    private readonly aiInFlightService: AiInFlightService,
    private readonly eventManager: EventManagerService,
    private readonly taskProcessor: TaskQueueProcessor,
    private readonly taskQueueService: TaskQueueService,
  ) {}

  onModuleInit() {
    this.registerTaskHandlers()
  }

  private registerTaskHandlers() {
    // Translation handler
    this.taskProcessor.registerHandler({
      type: AITaskType.Translation,
      execute: async (
        payload: TranslationTaskPayload,
        context: TaskExecuteContext,
      ) => {
        await this.executeTranslationTask(payload, context)
      },
    })

    // Translation batch handler
    this.taskProcessor.registerHandler({
      type: AITaskType.TranslationBatch,
      execute: async (
        payload: TranslationBatchTaskPayload,
        context: TaskExecuteContext,
      ) => {
        await this.executeTranslationBatchTask(payload, context)
      },
    })

    // Translation all handler
    this.taskProcessor.registerHandler({
      type: AITaskType.TranslationAll,
      execute: async (
        payload: TranslationAllTaskPayload,
        context: TaskExecuteContext,
      ) => {
        await this.executeTranslationAllTask(payload, context)
      },
    })

    this.logger.log('AI translation task handlers registered')
  }

  private async executeTranslationTask(
    payload: TranslationTaskPayload,
    context: TaskExecuteContext,
  ) {
    this.checkAborted(context)

    const aiConfig = await this.configService.get('ai')
    const languages = payload.targetLanguages?.length
      ? payload.targetLanguages
      : aiConfig.translationTargetLanguages || []

    if (!languages.length) {
      await context.appendLog('warn', 'No target languages specified')
      return
    }

    await context.updateProgress(0, 'Starting translation', 0, languages.length)

    const translations: Array<{
      translationId: string
      lang: string
      title: string
    }> = []

    let failedCount = 0

    for (let i = 0; i < languages.length; i++) {
      this.checkAborted(context)

      const lang = languages[i]
      await context.appendLog(
        'info',
        `Translating to ${lang} (${i + 1}/${languages.length})`,
      )

      try {
        const result = await this.generateTranslation(
          payload.refId,
          lang,
          context.incrementTokens,
        )
        translations.push({
          translationId: result.id,
          lang: result.lang,
          title: result.title,
        })
      } catch (error) {
        failedCount++
        await context.appendLog(
          'error',
          `Failed to translate to ${lang}: ${error.message}`,
        )
      }

      const progress = Math.round(((i + 1) / languages.length) * 100)
      await context.updateProgress(
        progress,
        `Translated ${i + 1}/${languages.length}`,
        i + 1,
        languages.length,
      )
    }

    await context.setResult({ translations })

    // Set status based on results
    if (failedCount === languages.length) {
      // All failed
      context.setStatus(TaskStatus.Failed)
    } else if (failedCount > 0) {
      // Some failed
      context.setStatus(TaskStatus.PartialFailed)
    }
    // If no failures, status will default to Completed
  }

  private async executeTranslationBatchTask(
    payload: TranslationBatchTaskPayload,
    context: TaskExecuteContext,
  ) {
    this.checkAborted(context)

    const { refIds, targetLanguages } = payload
    const total = refIds.length

    await context.appendLog(
      'info',
      `Creating ${total} translation tasks for batch`,
    )

    // Fetch article info for all refIds
    const articles = await this.databaseService.findGlobalByIds(refIds)
    const articleMap = new Map<string, { title: string; type: string }>()
    for (const post of articles.posts) {
      articleMap.set(post.id, { title: post.title, type: 'Post' })
    }
    for (const note of articles.notes) {
      articleMap.set(note.id, { title: note.title, type: 'Note' })
    }
    for (const page of articles.pages) {
      articleMap.set(page.id, { title: page.title, type: 'Page' })
    }

    const createdTaskIds: string[] = []

    for (const refId of refIds) {
      this.checkAborted(context)

      const articleInfo = articleMap.get(refId)
      const taskPayload: TranslationTaskPayload = {
        refId,
        targetLanguages,
        title: articleInfo?.title,
        refType: articleInfo?.type,
      }

      const dedupKey = computeAITaskDedupKey(
        AITaskType.Translation,
        taskPayload,
      )
      const result = await this.taskQueueService.createTask({
        type: AITaskType.Translation,
        payload: taskPayload as unknown as Record<string, unknown>,
        dedupKey,
        groupId: context.taskId,
      })

      if (result.created) {
        createdTaskIds.push(result.taskId)
        await context.appendLog(
          'info',
          `Created task for "${articleInfo?.title || refId}"`,
        )
      } else {
        await context.appendLog(
          'info',
          `Task already exists for "${articleInfo?.title || refId}": ${result.taskId}`,
        )
      }
    }

    await context.setResult({
      total,
      createdCount: createdTaskIds.length,
      taskIds: createdTaskIds,
      groupId: context.taskId,
    })

    await context.appendLog(
      'info',
      `Batch task completed: created ${createdTaskIds.length}/${total} tasks (groupId: ${context.taskId})`,
    )
  }

  private async executeTranslationAllTask(
    payload: TranslationAllTaskPayload,
    context: TaskExecuteContext,
  ) {
    this.checkAborted(context)

    const aiConfig = await this.configService.get('ai')
    const languages = payload.targetLanguages?.length
      ? payload.targetLanguages
      : aiConfig.translationTargetLanguages || []

    if (!languages.length) {
      await context.appendLog('warn', 'No target languages specified')
      return
    }

    await context.appendLog('info', 'Fetching all articles for translation')

    const postModel = this.databaseService.getModelByRefType(
      CollectionRefTypes.Post,
    )
    const noteModel = this.databaseService.getModelByRefType(
      CollectionRefTypes.Note,
    )
    const pageModel = this.databaseService.getModelByRefType(
      CollectionRefTypes.Page,
    )

    const [posts, notes, pages] = await Promise.all([
      postModel
        .find({ isPublished: { $ne: false } })
        .select('_id title')
        .lean(),
      noteModel
        .find({
          isPublished: { $ne: false },
          password: { $in: [null, ''] },
          $or: [{ publicAt: null }, { publicAt: { $lte: new Date() } }],
        })
        .select('_id title')
        .lean(),
      pageModel.find().select('_id title').lean(),
    ])

    // Build article info map
    const articleMap = new Map<string, { title: string; type: string }>()
    for (const post of posts) {
      articleMap.set(post._id.toString(), { title: post.title, type: 'Post' })
    }
    for (const note of notes) {
      articleMap.set(note._id.toString(), { title: note.title, type: 'Note' })
    }
    for (const page of pages) {
      articleMap.set(page._id.toString(), { title: page.title, type: 'Page' })
    }

    const allArticleIds = Array.from(articleMap.keys())
    const total = allArticleIds.length

    if (total === 0) {
      await context.appendLog('info', 'No articles found for translation')
      await context.setResult({ total: 0, createdCount: 0 })
      return
    }

    await context.appendLog(
      'info',
      `Found ${total} articles to translate to ${languages.join(', ')}`,
    )
    await context.updateProgress(
      0,
      `Creating tasks for ${total} articles`,
      0,
      total,
    )

    const createdTaskIds: string[] = []

    for (let i = 0; i < allArticleIds.length; i++) {
      this.checkAborted(context)

      const refId = allArticleIds[i]
      const articleInfo = articleMap.get(refId)

      const taskPayload: TranslationTaskPayload = {
        refId,
        targetLanguages: languages,
        title: articleInfo?.title,
        refType: articleInfo?.type,
      }

      const dedupKey = computeAITaskDedupKey(
        AITaskType.Translation,
        taskPayload,
      )
      const result = await this.taskQueueService.createTask({
        type: AITaskType.Translation,
        payload: taskPayload as unknown as Record<string, unknown>,
        dedupKey,
        groupId: context.taskId,
      })

      if (result.created) {
        createdTaskIds.push(result.taskId)
      }

      // Update progress every 10 items
      if ((i + 1) % 10 === 0 || i === allArticleIds.length - 1) {
        const progress = Math.round(((i + 1) / total) * 100)
        await context.updateProgress(
          progress,
          `Created ${createdTaskIds.length} tasks`,
          i + 1,
          total,
        )
      }
    }

    await context.setResult({
      total,
      createdCount: createdTaskIds.length,
      taskIds: createdTaskIds,
      groupId: context.taskId,
    })

    await context.appendLog(
      'info',
      `All task completed: created ${createdTaskIds.length}/${total} translation tasks (groupId: ${context.taskId})`,
    )
  }

  private checkAborted(context: TaskExecuteContext) {
    if (context.isAborted()) {
      const error = new Error('Task aborted')
      error.name = 'AbortError'
      throw error
    }
  }

  private extractIdFromEvent(event: ArticleEventPayload): string | null {
    if ('data' in event) {
      return event.data ?? null
    }
    if (event._id && typeof event._id === 'string') {
      return event._id
    }
    return event.id ?? event._id?.toString?.() ?? null
  }

  private getMetaLang(document: {
    meta?: { lang?: string }
  }): string | undefined {
    return document.meta?.lang
  }

  private toArticleContent(document: ArticleDocument): ArticleContent {
    return {
      title: document.title,
      text: document.text,
      summary:
        'summary' in document ? (document.summary ?? undefined) : undefined,
      tags: 'tags' in document ? document.tags : undefined,
    }
  }

  private isPostArticle(
    article: GlobalArticle,
  ): article is { type: CollectionRefTypes.Post; document: PostModel } {
    return article.type === CollectionRefTypes.Post
  }

  private isNoteArticle(
    article: GlobalArticle,
  ): article is { type: CollectionRefTypes.Note; document: NoteModel } {
    return article.type === CollectionRefTypes.Note
  }

  private isPageArticle(
    article: GlobalArticle,
  ): article is { type: CollectionRefTypes.Page; document: PageModel } {
    return article.type === CollectionRefTypes.Page
  }

  private isArticleVisible(article: GlobalArticle): boolean {
    if (this.isPostArticle(article)) {
      return article.document.isPublished !== false
    }

    if (this.isNoteArticle(article)) {
      const document = article.document
      if (document.isPublished === false) return false
      if (document.password) return false
      if (document.publicAt && dayjs(document.publicAt).isAfter(new Date())) {
        return false
      }
      return true
    }

    if (this.isPageArticle(article)) {
      return true
    }

    return false
  }

  /**
   * 获取并验证文章，用于翻译相关操作
   */
  private async resolveArticleForTranslation(articleId: string): Promise<{
    document: ArticleDocument
    type:
      | CollectionRefTypes.Post
      | CollectionRefTypes.Note
      | CollectionRefTypes.Page
  }> {
    const article = await this.databaseService.findGlobalById(articleId)
    if (!article || !article.document) {
      throw new BizException(ErrorCodeEnum.ContentNotFoundCantProcess)
    }

    if (article.type === CollectionRefTypes.Recently) {
      throw new BizException(ErrorCodeEnum.ContentNotFoundCantProcess)
    }

    return {
      document: article.document as ArticleDocument,
      type: article.type,
    }
  }

  /**
   * 检查数据库中是否存在 hash 匹配的有效翻译
   */
  private async findValidTranslation(
    articleId: string,
    targetLang: string,
    document: ArticleDocument,
  ): Promise<AITranslationModel | null> {
    const translation = await this.aiTranslationModel.findOne({
      refId: articleId,
      lang: targetLang,
    })

    if (!translation) {
      return null
    }

    const sourceLang =
      this.getMetaLang(document) || translation.sourceLang || 'unknown'
    const currentHash = this.computeContentHash(
      this.toArticleContent(document),
      sourceLang,
    )

    if (translation.hash !== currentHash) {
      return null
    }

    return translation
  }

  /**
   * 将已有翻译包装为立即返回的 stream 格式
   */
  private wrapAsImmediateStream(translation: AITranslationModel): {
    events: AsyncIterable<AiStreamEvent>
    result: Promise<AITranslationModel>
  } {
    const events = (async function* () {
      yield { type: 'done' as const, data: { resultId: translation.id } }
    })()

    return {
      events,
      result: Promise.resolve(translation),
    }
  }

  private computeContentHash(
    document: ArticleContent,
    sourceLang: string,
  ): string {
    return md5(
      JSON.stringify({
        title: document.title,
        text: document.text,
        summary: document.summary,
        tags: document.tags,
        sourceLang,
      }),
    )
  }

  private buildTranslationKey(
    articleId: string,
    targetLang: string,
    content: ArticleContent,
  ): string {
    return md5(
      JSON.stringify({
        feature: 'translation',
        articleId,
        targetLang,
        title: content.title,
        text: this.serializeText(content.text),
        summary: content.summary ?? null,
        tags: content.tags ?? null,
      }),
    )
  }

  private serializeText(text: string): string {
    return removeMdCodeblock(text)
  }

  private async translateContentStream(
    content: ArticleContent,
    targetLang: string,
    push?: (event: AiStreamEvent) => Promise<void>,
    onToken?: (count?: number) => Promise<void>,
  ): Promise<{
    sourceLang: string
    title: string
    text: string
    summary: string | null
    tags: string[] | null
    aiModel: string
    aiProvider: string
  }> {
    const { runtime, info } = await this.aiService.getTranslationModelWithInfo()

    const { systemPrompt, prompt, reasoningEffort } =
      AI_PROMPTS.translationStream(targetLang, {
        title: content.title,
        text: this.serializeText(content.text),
        summary: content.summary ?? undefined,
        tags: content.tags,
      })

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: prompt },
    ]

    let fullText = ''
    if (runtime.generateTextStream) {
      for await (const chunk of runtime.generateTextStream({
        messages,
        temperature: 0.3,
        maxRetries: 2,
        reasoningEffort,
      })) {
        fullText += chunk.text
        if (push) {
          await push({ type: 'token', data: chunk.text })
        }
        if (onToken) {
          await onToken()
        }
      }
    } else {
      const result = await runtime.generateText({
        messages,
        temperature: 0.3,
        maxRetries: 2,
        reasoningEffort,
      })
      fullText = result.text
      if (push && result.text) {
        await push({ type: 'token', data: result.text })
      }
      if (onToken && result.text) {
        await onToken()
      }
    }

    const parsed = JSON.parse(fullText) as {
      sourceLang?: string
      title?: string
      text?: string
      summary?: string | null
      tags?: string[] | null
    }

    if (!parsed?.title || !parsed?.text || !parsed?.sourceLang) {
      throw new Error('Invalid translation JSON response')
    }

    return {
      sourceLang: parsed.sourceLang,
      title: parsed.title,
      text: parsed.text,
      summary: parsed.summary ?? null,
      tags: parsed.tags ?? null,
      aiModel: info.model,
      aiProvider: info.provider,
    }
  }

  async generateTranslation(
    articleId: string,
    targetLang: string,
    onToken?: (count?: number) => Promise<void>,
  ): Promise<AITranslationModel> {
    const startedAt = Date.now()
    const aiConfig = await this.configService.get('ai')
    if (!aiConfig.enableTranslation) {
      throw new BizException(ErrorCodeEnum.AINotEnabled)
    }

    const { document, type } =
      await this.resolveArticleForTranslation(articleId)

    this.logger.log(
      `AI translation start: article=${articleId} target=${targetLang}`,
    )

    try {
      const { result } = await this.runTranslationGeneration(
        articleId,
        targetLang,
        type,
        document,
        onToken,
      )
      const translated = await result
      this.logger.log(
        `AI translation done: article=${articleId} target=${targetLang} ms=${
          Date.now() - startedAt
        }`,
      )
      return translated
    } catch (error) {
      if (error instanceof BizException) {
        throw error
      }
      this.logger.error(
        `AI translation failed for article ${articleId}: ${error.message}`,
        error.stack,
      )
      throw new BizException(ErrorCodeEnum.AIException, error.message)
    }
  }

  private async runTranslationGeneration(
    articleId: string,
    targetLang: string,
    refType: CollectionRefTypes,
    document: ArticleDocument,
    onToken?: (count?: number) => Promise<void>,
  ) {
    const content = this.toArticleContent(document)
    const sourceModified = document.modified ?? undefined
    const key = this.buildTranslationKey(articleId, targetLang, content)

    return this.aiInFlightService.runWithStream<AITranslationModel>({
      key,
      lockTtlSec: AI_STREAM_LOCK_TTL,
      resultTtlSec: AI_STREAM_RESULT_TTL,
      streamMaxLen: AI_STREAM_MAXLEN,
      readBlockMs: AI_STREAM_READ_BLOCK_MS,
      idleTimeoutMs: AI_STREAM_IDLE_TIMEOUT_MS,
      onLeader: async ({ push }) => {
        const translated = await this.translateContentStream(
          content,
          targetLang,
          push,
          onToken,
        )
        const { sourceLang } = translated
        const hash = this.computeContentHash(content, sourceLang)

        const existing = await this.aiTranslationModel.findOne({
          refId: articleId,
          refType,
          lang: targetLang,
        })

        if (existing) {
          existing.hash = hash
          existing.sourceLang = sourceLang
          existing.title = translated.title
          existing.text = translated.text
          existing.summary = translated.summary ?? undefined
          existing.tags = translated.tags ?? undefined
          if (sourceModified) {
            existing.sourceModified = sourceModified
          }
          existing.aiModel = translated.aiModel
          existing.aiProvider = translated.aiProvider
          await existing.save()
          this.logger.log(
            `AI translation updated: article=${articleId} target=${targetLang}`,
          )

          // 发送翻译更新事件
          this.emitTranslationEvent(BusinessEvents.TRANSLATION_UPDATE, existing)

          return { result: existing, resultId: existing.id }
        }

        const created = await this.aiTranslationModel.create({
          hash,
          refId: articleId,
          refType,
          lang: targetLang,
          sourceLang,
          title: translated.title,
          text: translated.text,
          summary: translated.summary ?? undefined,
          tags: translated.tags ?? undefined,
          sourceModified,
          aiModel: translated.aiModel,
          aiProvider: translated.aiProvider,
        })
        this.logger.log(
          `AI translation created: article=${articleId} target=${targetLang}`,
        )

        // 发送翻译创建事件
        this.emitTranslationEvent(BusinessEvents.TRANSLATION_CREATE, created)

        return { result: created, resultId: created.id }
      },
      parseResult: async (resultId) => {
        const doc = await this.aiTranslationModel.findById(resultId)
        if (!doc) {
          throw new BizException(ErrorCodeEnum.AITranslationNotFound)
        }
        return doc
      },
    })
  }

  async streamTranslationForArticle(
    articleId: string,
    targetLang: string,
  ): Promise<{
    events: AsyncIterable<AiStreamEvent>
    result: Promise<AITranslationModel>
  }> {
    const aiConfig = await this.configService.get('ai')
    if (!aiConfig.enableTranslation) {
      throw new BizException(ErrorCodeEnum.AINotEnabled)
    }

    const { document, type } =
      await this.resolveArticleForTranslation(articleId)

    // 检查数据库中是否已有有效翻译（hash 匹配）
    const existingTranslation = await this.findValidTranslation(
      articleId,
      targetLang,
      document,
    )

    if (existingTranslation) {
      this.logger.debug(
        `Translation cache hit: article=${articleId} lang=${targetLang}`,
      )
      return this.wrapAsImmediateStream(existingTranslation)
    }

    return this.runTranslationGeneration(articleId, targetLang, type, document)
  }

  private emitTranslationEvent(
    eventType: BusinessEvents,
    translation: AITranslationModel,
  ) {
    const payload = {
      id: translation.id,
      refId: translation.refId,
      refType: translation.refType,
      lang: translation.lang,
      sourceLang: translation.sourceLang,
      title: translation.title,
      text: translation.text,
      summary: translation.summary,
      tags: translation.tags,
      hash: translation.hash,
      aiModel: translation.aiModel,
      aiProvider: translation.aiProvider,
    }

    this.eventManager.emit(eventType, payload, {
      scope: EventScope.TO_VISITOR,
    })
  }

  async generateTranslationsForLanguages(
    articleId: string,
    targetLanguages?: string[],
  ): Promise<AITranslationModel[]> {
    const aiConfig = await this.configService.get('ai')
    const languages = targetLanguages?.length
      ? targetLanguages
      : aiConfig.translationTargetLanguages || []

    if (!languages.length) {
      return []
    }

    const results: AITranslationModel[] = []
    for (const lang of languages) {
      try {
        const translation = await this.generateTranslation(articleId, lang)
        results.push(translation)
      } catch (error) {
        this.logger.error(
          `Failed to generate translation for ${articleId} to ${lang}: ${error.message}`,
        )
      }
    }

    return results
  }

  async getTranslationsByRefId(refId: string) {
    const article = await this.databaseService.findGlobalById(refId)
    if (!article) {
      throw new BizException(ErrorCodeEnum.ContentNotFound)
    }

    const translations = await this.aiTranslationModel.find({ refId })
    return { translations, article }
  }

  async getTranslationById(id: string) {
    const doc = await this.aiTranslationModel.findById(id)
    if (!doc) {
      throw new BizException(ErrorCodeEnum.AITranslationNotFound)
    }
    return doc
  }

  async getAllTranslationsGrouped(query: GetTranslationsGroupedQueryInput) {
    const { page, size, search } = query

    // 如果有搜索关键词，先搜索文章
    let matchedRefIds: string[] | null = null
    if (search && search.trim()) {
      const keyword = search.trim()
      const postModel = this.databaseService.getModelByRefType(
        CollectionRefTypes.Post,
      )
      const noteModel = this.databaseService.getModelByRefType(
        CollectionRefTypes.Note,
      )
      const pageModel = this.databaseService.getModelByRefType(
        CollectionRefTypes.Page,
      )

      const [matchedPosts, matchedNotes, matchedPages] = await Promise.all([
        postModel
          .find({ title: { $regex: keyword, $options: 'i' } })
          .select('_id')
          .lean(),
        noteModel
          .find({ title: { $regex: keyword, $options: 'i' } })
          .select('_id')
          .lean(),
        pageModel
          .find({ title: { $regex: keyword, $options: 'i' } })
          .select('_id')
          .lean(),
      ])

      matchedRefIds = [
        ...matchedPosts.map((p) => p._id.toString()),
        ...matchedNotes.map((n) => n._id.toString()),
        ...matchedPages.map((p) => p._id.toString()),
      ]

      if (matchedRefIds.length === 0) {
        return {
          data: [],
          pagination: {
            total: 0,
            currentPage: page,
            totalPage: 0,
            size,
            hasNextPage: false,
            hasPrevPage: false,
          },
        }
      }
    }

    const matchStage = matchedRefIds
      ? { $match: { refId: { $in: matchedRefIds } } }
      : null

    const pipeline: any[] = []
    if (matchStage) {
      pipeline.push(matchStage)
    }
    pipeline.push(
      {
        $group: {
          _id: '$refId',
          latestCreated: { $max: '$created' },
          translationCount: { $sum: 1 },
        },
      },
      { $sort: { latestCreated: -1 } },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [{ $skip: (page - 1) * size }, { $limit: size }],
        },
      },
    )

    const aggregateResult = await this.aiTranslationModel.aggregate(pipeline)

    const metadata = aggregateResult[0]?.metadata[0]
    const groupedRefIds = aggregateResult[0]?.data || []
    const total = metadata?.total || 0

    if (groupedRefIds.length === 0) {
      return {
        data: [],
        pagination: {
          total: 0,
          currentPage: page,
          totalPage: 0,
          size,
          hasNextPage: false,
          hasPrevPage: false,
        },
      }
    }

    const refIds = groupedRefIds.map((g: { _id: string }) => g._id)
    const translations = await this.aiTranslationModel
      .find({ refId: { $in: refIds } })
      .sort({ created: -1 })
      .lean()

    const articles = await this.databaseService.findGlobalByIds(refIds)
    const articleMap = {} as Record<
      string,
      { title: string; id: string; type: CollectionRefTypes }
    >

    for (const a of articles.notes) {
      articleMap[a.id] = {
        title: a.title,
        id: a.id,
        type: CollectionRefTypes.Note,
      }
    }
    for (const a of articles.posts) {
      articleMap[a.id] = {
        title: a.title,
        id: a.id,
        type: CollectionRefTypes.Post,
      }
    }
    for (const a of articles.pages) {
      articleMap[a.id] = {
        title: a.title,
        id: a.id,
        type: CollectionRefTypes.Page,
      }
    }

    const translationsByRefId = translations.reduce(
      (acc, trans) => {
        if (!acc[trans.refId]) {
          acc[trans.refId] = []
        }
        acc[trans.refId].push(trans)
        return acc
      },
      {} as Record<string, AITranslationModel[]>,
    )

    const groupedData = refIds
      .map((refId: string) => {
        const article = articleMap[refId]
        if (!article) return null
        return {
          article,
          translations: translationsByRefId[refId] || [],
        }
      })
      .filter(Boolean)

    const totalPage = Math.ceil(total / size)

    return {
      data: groupedData,
      pagination: {
        total,
        currentPage: page,
        totalPage,
        size,
        hasNextPage: page < totalPage,
        hasPrevPage: page > 1,
      },
    }
  }

  async updateTranslation(
    id: string,
    data: {
      title?: string
      text?: string
      summary?: string
      tags?: string[]
    },
  ) {
    const doc = await this.aiTranslationModel.findById(id)
    if (!doc) {
      throw new BizException(ErrorCodeEnum.AITranslationNotFound)
    }

    if (data.title !== undefined) doc.title = data.title
    if (data.text !== undefined) doc.text = data.text
    if (data.summary !== undefined) doc.summary = data.summary
    if (data.tags !== undefined) doc.tags = data.tags

    await doc.save()
    return doc
  }

  async deleteTranslation(id: string) {
    const result = await this.aiTranslationModel.deleteOne({ _id: id })
    if (result.deletedCount === 0) {
      throw new BizException(ErrorCodeEnum.AITranslationNotFound)
    }
  }

  async deleteTranslationsByRefId(refId: string) {
    await this.aiTranslationModel.deleteMany({ refId })
  }

  async getTranslationForArticle(
    articleId: string,
    targetLang: string,
    options?: { ignoreVisibility?: boolean },
  ): Promise<AITranslationModel | null> {
    const article = await this.databaseService.findGlobalById(articleId)
    if (!article || !article.document) {
      throw new BizException(ErrorCodeEnum.ContentNotFound)
    }

    if (!options?.ignoreVisibility && !this.isArticleVisible(article)) {
      if (article.type === CollectionRefTypes.Post) {
        throw new BizException(ErrorCodeEnum.PostHiddenOrEncrypted)
      }
      throw new BizException(ErrorCodeEnum.NoteForbidden)
    }

    return this.findValidTranslation(
      articleId,
      targetLang,
      article.document as ArticleDocument,
    )
  }

  async getValidTranslationsForArticles(
    articles: Array<{
      id: string
      title: string
      text?: string
      summary?: string | null
      tags?: string[]
      meta?: { lang?: string }
      modified?: Date | null
      created?: Date | null
    }>,
    targetLang: string,
    options?: {
      select?: string
    },
  ): Promise<Map<string, AITranslationModel>> {
    if (!articles.length) {
      return new Map()
    }

    const requiredSelectFields = [
      'refId',
      'hash',
      'sourceLang',
      'sourceModified',
      'created',
    ]
    const defaultSelect =
      'refId refType lang sourceLang title text summary tags hash sourceModified created aiModel aiProvider'
    const select = options?.select
      ? `${options.select} ${requiredSelectFields.join(' ')}`
      : defaultSelect

    const query = this.aiTranslationModel.find({
      refId: { $in: articles.map((article) => article.id) },
      lang: targetLang,
    })

    query.select(select)

    const translations = await query

    if (!translations.length) {
      return new Map()
    }

    const translationMap = new Map(
      translations.map((translation) => [translation.refId, translation]),
    )
    const result = new Map<string, AITranslationModel>()

    for (const article of articles) {
      const translation = translationMap.get(article.id)
      if (!translation) {
        continue
      }

      const articleTimestamp = article.modified ?? article.created ?? null

      if (translation.sourceModified && articleTimestamp) {
        if (translation.sourceModified >= articleTimestamp) {
          result.set(article.id, translation)
        }
        continue
      }

      if (
        !translation.sourceModified &&
        articleTimestamp &&
        translation.created &&
        translation.created >= articleTimestamp
      ) {
        result.set(article.id, translation)
        continue
      }

      const sourceLang =
        article.meta?.lang || translation.sourceLang || 'unknown'

      const currentHash = this.computeContentHash(
        {
          title: article.title,
          text: article.text ?? '',
          summary: article.summary ?? undefined,
          tags: article.tags,
        },
        sourceLang,
      )

      if (translation.hash === currentHash) {
        result.set(article.id, translation)
      }
    }

    return result
  }

  async getAvailableLanguagesForArticle(articleId: string): Promise<string[]> {
    const article = await this.databaseService.findGlobalById(articleId)
    if (!article || !article.document || !this.isArticleVisible(article)) {
      return []
    }

    const document = article.document as ArticleDocument
    const translations = await this.aiTranslationModel.find({
      refId: articleId,
    })

    if (!translations.length) {
      return []
    }

    const sourceLang =
      this.getMetaLang(document) || translations[0]?.sourceLang || 'unknown'
    const currentHash = this.computeContentHash(
      this.toArticleContent(document),
      sourceLang,
    )

    return translations.filter((t) => t.hash === currentHash).map((t) => t.lang)
  }

  @OnEvent(BusinessEvents.POST_DELETE)
  @OnEvent(BusinessEvents.NOTE_DELETE)
  @OnEvent(BusinessEvents.PAGE_DELETE)
  async handleDeleteArticle(event: ArticleEventPayload) {
    const id = this.extractIdFromEvent(event)
    if (!id) return
    await this.deleteTranslationsByRefId(id)
  }

  @OnEvent(BusinessEvents.POST_CREATE)
  @OnEvent(BusinessEvents.NOTE_CREATE)
  @OnEvent(BusinessEvents.PAGE_CREATE)
  async handleCreateArticle(event: ArticleEventPayload) {
    const aiConfig = await this.configService.get('ai')

    if (
      !aiConfig.enableAutoGenerateTranslation ||
      !aiConfig.enableTranslation
    ) {
      return
    }

    const id = this.extractIdFromEvent(event)
    if (!id) return

    const article = await this.databaseService.findGlobalById(id)
    if (!article || !this.isArticleVisible(article)) {
      return
    }

    const targetLanguages = aiConfig.translationTargetLanguages || []
    if (!targetLanguages.length) {
      return
    }

    scheduleManager.schedule(async () => {
      try {
        this.logger.log(
          `AI auto translation start: article=${id} targets=${targetLanguages.join(
            ',',
          )}`,
        )
        await this.generateTranslationsForLanguages(id, targetLanguages)
        this.logger.log(`AI auto translation done: article=${id}`)
      } catch (error) {
        this.logger.error(
          `Auto translation failed for article ${id}: ${error.message}`,
        )
      }
    })
  }

  @OnEvent(BusinessEvents.POST_UPDATE)
  @OnEvent(BusinessEvents.NOTE_UPDATE)
  @OnEvent(BusinessEvents.PAGE_UPDATE)
  async handleUpdateArticle(event: ArticleEventPayload) {
    const aiConfig = await this.configService.get('ai')
    if (
      !aiConfig.enableAutoGenerateTranslation ||
      !aiConfig.enableTranslation
    ) {
      return
    }

    const id = this.extractIdFromEvent(event)
    if (!id) return

    const article = await this.databaseService.findGlobalById(id)
    if (!article || !this.isArticleVisible(article)) {
      return
    }

    const targetLanguages = aiConfig.translationTargetLanguages || []
    if (!targetLanguages.length) {
      return
    }

    const existingTranslations = await this.aiTranslationModel.find({
      refId: id,
    })
    if (!existingTranslations.length) {
      scheduleManager.schedule(async () => {
        try {
          this.logger.log(
            `AI auto translation update init: article=${id} targets=${targetLanguages.join(
              ',',
            )}`,
          )
          await this.generateTranslationsForLanguages(id, targetLanguages)
          this.logger.log(`AI auto translation update init done: article=${id}`)
        } catch (error) {
          this.logger.error(
            `Auto translation update init failed for article ${id}: ${error.message}`,
          )
        }
      })
      return
    }

    const document = article.document as ArticleDocument
    const sourceLang =
      this.getMetaLang(document) ||
      existingTranslations[0]?.sourceLang ||
      'unknown'
    const newHash = this.computeContentHash(
      this.toArticleContent(document),
      sourceLang,
    )

    const outdatedLanguages = existingTranslations
      .filter((t) => t.hash !== newHash)
      .map((t) => t.lang)

    if (!outdatedLanguages.length) {
      return
    }

    scheduleManager.schedule(async () => {
      try {
        this.logger.log(
          `AI auto translation update start: article=${id} targets=${outdatedLanguages.join(
            ',',
          )}`,
        )
        await this.generateTranslationsForLanguages(id, outdatedLanguages)
        this.logger.log(`AI auto translation update done: article=${id}`)
      } catch (error) {
        this.logger.error(
          `Auto translation update failed for article ${id}: ${error.message}`,
        )
      }
    })
  }
}
