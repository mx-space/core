/* eslint-disable unicorn/better-regex */
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { BizException } from '~/common/exceptions/biz.exception'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { CollectionRefTypes } from '~/constants/db.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { DatabaseService } from '~/processors/database/database.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { LexicalService } from '~/processors/helper/helper.lexical.service'
import {
  TaskQueueProcessor,
  TaskStatus,
  type TaskExecuteContext,
} from '~/processors/task-queue'
import { ContentFormat } from '~/shared/types/content-format.type'
import { InjectModel } from '~/transformers/model.transformer'
import { computeContentHash as computeContentHashUtil } from '~/utils/content.util'
import { extractFirstJsonObject } from '~/utils/json.util'
import { md5 } from '~/utils/tool.util'
import dayjs from 'dayjs'
import JSON5 from 'json5'
import { ConfigsService } from '../../configs/configs.service'
import type { NoteModel } from '../../note/note.model'
import type { PageModel } from '../../page/page.model'
import type { PostModel } from '../../post/post.model'
import { AiInFlightService } from '../ai-inflight/ai-inflight.service'
import type { AiStreamEvent } from '../ai-inflight/ai-inflight.types'
import { AiTaskService } from '../ai-task/ai-task.service'
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
import { IModelRuntime } from '../runtime'
import { AITranslationModel } from './ai-translation.model'
import type { GetTranslationsGroupedQueryInput } from './ai-translation.schema'
import {
  extractDocumentContext,
  parseLexicalForTranslation,
  restoreLexicalTranslation,
} from './lexical-translation-parser'

interface ArticleContent {
  title: string
  text: string
  summary?: string | null
  tags?: string[]
  meta?: { lang?: string }
  contentFormat?: string
  content?: string
}

type ArticleDocument = PostModel | NoteModel | PageModel

type ArticleEventDocument = ArticleDocument & {
  _id?: { toString?: () => string } | string
}

type ArticleEventPayload =
  | ArticleEventDocument
  | { data: string }
  | { id: string }

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
    private readonly lexicalService: LexicalService,
    private readonly aiTaskService: AiTaskService,
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

  private parseModelJson<T extends Record<string, any>>(
    rawText: string,
    context: string,
  ): T {
    const trimmed = rawText.trim()
    const candidates = new Set<string>()

    const addCandidate = (value: string | null | undefined) => {
      if (!value) return
      const text = value.trim()
      if (!text) return
      candidates.add(text)
    }

    addCandidate(trimmed)

    const codeFenceMatch = trimmed.match(
      // eslint-disable-next-line regexp/no-super-linear-backtracking
      /^```(?:json|JSON)?\s*([\s\S]*?)\s*```$/,
    )
    addCandidate(codeFenceMatch?.[1])
    addCandidate(extractFirstJsonObject(trimmed))
    if (codeFenceMatch?.[1]) {
      addCandidate(extractFirstJsonObject(codeFenceMatch[1]))
    }

    let lastError: unknown

    for (const candidate of candidates) {
      try {
        return JSON.parse(candidate) as T
      } catch (error) {
        // eslint-disable-next-line no-useless-assignment
        lastError = error
      }
      try {
        return JSON5.parse(candidate) as T
      } catch (error) {
        lastError = error
      }
    }

    this.logger.warn(
      `${context}: failed to parse model JSON. length=${rawText.length} head=${JSON.stringify(
        trimmed.slice(0, 240),
      )} tail=${JSON.stringify(trimmed.slice(-240))}`,
    )

    throw new Error(
      `${context}: invalid JSON output (${
        lastError instanceof Error ? lastError.message : String(lastError)
      })`,
    )
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
          context.signal,
        )
        translations.push({
          translationId: result.id,
          lang: result.lang,
          title: result.title,
        })
      } catch (error) {
        if (error.name === 'AbortError') throw error
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
      const result = await this.aiTaskService.crud.createTask({
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
      const result = await this.aiTaskService.crud.createTask({
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

  private async cancelActiveTranslationTasks(refId: string) {
    for (const status of [TaskStatus.Running, TaskStatus.Pending]) {
      const { data: tasks } = await this.aiTaskService.crud.getTasks({
        type: AITaskType.Translation,
        status,
        page: 1,
        size: 100,
        includeSubTasks: true,
      })
      for (const task of tasks) {
        const payload = task.payload as Record<string, unknown> | undefined
        if (
          !payload ||
          typeof payload.refId !== 'string' ||
          payload.refId !== refId
        )
          continue
        try {
          await this.aiTaskService.crud.cancelTask(task.id)
          this.logger.log(
            `Cancelled stale translation task ${task.id} for article=${refId}`,
          )
        } catch {
          // task may already be completed
        }
      }
    }
  }

  private extractIdFromEvent(event: ArticleEventPayload): string | null {
    if ('data' in event) {
      return (event as { data: string }).data ?? null
    }
    if ('id' in event && typeof event.id === 'string') {
      return event.id
    }
    const doc = event as ArticleEventDocument
    if (doc._id && typeof doc._id === 'string') {
      return doc._id
    }
    return doc.id ?? doc._id?.toString?.() ?? null
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
      contentFormat: document.contentFormat,
      content: document.content,
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
    if (document.contentFormat === ContentFormat.Lexical) {
      return computeContentHashUtil(
        {
          title: document.title,
          text: document.text,
          contentFormat: document.contentFormat,
          content: document.content,
          summary: document.summary,
          tags: document.tags,
        },
        sourceLang,
      )
    }
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
        contentFormat: content.contentFormat,
        title: content.title,
        text: content.text,
        content: content.content ?? null,
        summary: content.summary ?? null,
        tags: content.tags ?? null,
      }),
    )
  }
  private async translateContentStream(
    content: ArticleContent,
    targetLang: string,
    push?: (event: AiStreamEvent) => Promise<void>,
    onToken?: (count?: number) => Promise<void>,
    signal?: AbortSignal,
  ): Promise<{
    sourceLang: string
    title: string
    text: string
    summary: string | null
    tags: string[] | null
    aiModel: string
    aiProvider: string
    contentFormat?: string
    content?: string
  }> {
    const { runtime, info } = await this.aiService.getTranslationModelWithInfo()

    const isLexical = content.contentFormat === ContentFormat.Lexical

    if (isLexical) {
      return this.translateLexicalContent(
        content,
        targetLang,
        runtime,
        info,
        onToken,
        signal,
      )
    }

    return this.translateMarkdownContent(
      content,
      targetLang,
      runtime,
      info,
      push,
      onToken,
      signal,
    )
  }

  private async translateMarkdownContent(
    content: ArticleContent,
    targetLang: string,
    runtime: IModelRuntime,
    info: { model: string; provider: string },
    push?: (event: AiStreamEvent) => Promise<void>,
    onToken?: (count?: number) => Promise<void>,
    signal?: AbortSignal,
  ) {
    const { systemPrompt, prompt, reasoningEffort } =
      AI_PROMPTS.translationStream(targetLang, {
        title: content.title,
        text: content.text,
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
        signal,
      })) {
        if (signal?.aborted) {
          throw Object.assign(new Error('Task aborted'), { name: 'AbortError' })
        }
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
        signal,
      })
      fullText = result.text
      if (push && result.text) {
        await push({ type: 'token', data: result.text })
      }
      if (onToken && result.text) {
        await onToken()
      }
    }

    const parsed = this.parseModelJson<{
      sourceLang?: string
      title?: string
      text?: string
      summary?: string | null
      tags?: string[] | null
    }>(fullText, 'translateMarkdownContent')

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

  private async translateLexicalContent(
    content: ArticleContent,
    targetLang: string,
    runtime: IModelRuntime,
    info: { model: string; provider: string },
    onToken?: (count?: number) => Promise<void>,
    signal?: AbortSignal,
  ) {
    const parseResult = parseLexicalForTranslation(content.content!)
    const { segments, propertySegments, editorState } = parseResult
    const allTranslations = new Map<string, string>()
    let sourceLang = ''

    const documentContext = extractDocumentContext(
      editorState.root?.children ?? [],
    )

    // Build translatable entries
    const allEntries: Record<string, string> = {}
    const allEntryMeta: Record<string, string> = {}
    for (const seg of segments) {
      if (seg.translatable) {
        allEntries[seg.id] = seg.text
        allEntryMeta[seg.id] = 'text'
      }
    }
    for (const prop of propertySegments) {
      allEntries[prop.id] = prop.text
      if (prop.property === 'reading' && prop.node?.type === 'ruby') {
        allEntryMeta[prop.id] = 'ruby.reading'
      } else {
        allEntryMeta[prop.id] = `property.${prop.property}`
      }
    }

    // Meta entries
    const metaEntries: Record<string, string> = { __title__: content.title }
    const metaEntryMeta: Record<string, string> = { __title__: 'meta.title' }
    if (content.summary) metaEntries.__summary__ = content.summary
    if (content.summary) metaEntryMeta.__summary__ = 'meta.summary'
    if (content.tags?.length) {
      metaEntries.__tags__ = content.tags.join('|||')
      metaEntryMeta.__tags__ = 'meta.tags'
    }

    // Edge case: no translatable content
    if (Object.keys(allEntries).length === 0) {
      const result = await this.callChunkTranslation(
        targetLang,
        {
          documentContext: content.title,
          textEntries: metaEntries,
          segmentMeta: metaEntryMeta,
        },
        runtime,
        onToken,
        signal,
      )
      sourceLang = result.sourceLang
      for (const [id, text] of Object.entries(result.translations)) {
        allTranslations.set(id, text)
      }
    } else {
      // Split into batches by token budget
      const MAX_BATCH_TOKENS = 4000
      const estimateTokens = (text: string) => Math.ceil(text.length / 3)

      const batches: Array<{
        textEntries: Record<string, string>
        segmentMeta: Record<string, string>
      }> = []
      let currentBatch: Record<string, string> = { ...metaEntries }
      let currentBatchMeta: Record<string, string> = { ...metaEntryMeta }
      let currentTokens = Object.values(metaEntries).reduce(
        (s, t) => s + estimateTokens(t),
        0,
      )
      let hasContentEntry = false

      for (const [id, text] of Object.entries(allEntries)) {
        const tokens = estimateTokens(text)
        if (hasContentEntry && currentTokens + tokens > MAX_BATCH_TOKENS) {
          batches.push({
            textEntries: currentBatch,
            segmentMeta: currentBatchMeta,
          })
          currentBatch = {}
          currentBatchMeta = {}
          currentTokens = 0
        }
        currentBatch[id] = text
        currentBatchMeta[id] = allEntryMeta[id] ?? 'text'
        currentTokens += tokens
        hasContentEntry = true
      }
      if (Object.keys(currentBatch).length > 0) {
        batches.push({
          textEntries: currentBatch,
          segmentMeta: currentBatchMeta,
        })
      }

      for (const batch of batches) {
        if (signal?.aborted) {
          throw Object.assign(new Error('Task aborted'), { name: 'AbortError' })
        }
        const result = await this.callChunkTranslation(
          targetLang,
          {
            documentContext,
            textEntries: batch.textEntries,
            segmentMeta: batch.segmentMeta,
          },
          runtime,
          onToken,
          signal,
        )
        if (!sourceLang) sourceLang = result.sourceLang
        for (const [id, text] of Object.entries(result.translations)) {
          allTranslations.set(id, text)
        }

        // Validate: check for missing IDs and retry once
        const missingIds = Object.keys(batch.textEntries).filter(
          (id) => !(id in result.translations),
        )
        if (missingIds.length > 0) {
          const retryEntries: Record<string, string> = {}
          const retryMeta: Record<string, string> = {}
          for (const id of missingIds) {
            retryEntries[id] = batch.textEntries[id]
            if (batch.segmentMeta[id]) {
              retryMeta[id] = batch.segmentMeta[id]
            }
          }
          try {
            const retryResult = await this.callChunkTranslation(
              targetLang,
              {
                documentContext,
                textEntries: retryEntries,
                segmentMeta: retryMeta,
              },
              runtime,
              onToken,
              signal,
            )
            for (const [id, text] of Object.entries(retryResult.translations)) {
              allTranslations.set(id, text)
            }
            const stillMissing = missingIds.filter(
              (id) => !(id in retryResult.translations),
            )
            for (const id of stillMissing) {
              this.logger.warn(
                `Translation missing for segment ${id} after retry, falling back to original`,
              )
            }
          } catch {
            for (const id of missingIds) {
              this.logger.warn(
                `Translation retry failed for segment ${id}, falling back to original`,
              )
            }
          }
        }
      }
    }

    const translatedContent = restoreLexicalTranslation(
      parseResult,
      allTranslations,
    )
    const title = allTranslations.get('__title__') ?? content.title
    const summary =
      allTranslations.get('__summary__') ?? content.summary ?? null
    const tagsStr = allTranslations.get('__tags__')
    const tags = tagsStr ? tagsStr.split('|||') : (content.tags ?? null)

    return {
      sourceLang,
      title,
      text: this.lexicalService.lexicalToMarkdown(translatedContent),
      contentFormat: ContentFormat.Lexical,
      content: translatedContent,
      summary,
      tags,
      aiModel: info.model,
      aiProvider: info.provider,
    }
  }

  private async callChunkTranslation(
    targetLang: string,
    chunk: {
      documentContext: string
      textEntries: Record<string, string>
      segmentMeta?: Record<string, string>
    },
    runtime: any,
    onToken?: (count?: number) => Promise<void>,
    signal?: AbortSignal,
  ): Promise<{ sourceLang: string; translations: Record<string, string> }> {
    const { systemPrompt, prompt, reasoningEffort } =
      AI_PROMPTS.translationChunk(targetLang, chunk)

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: prompt },
    ]

    let fullText = ''
    if (runtime.generateTextStream) {
      for await (const c of runtime.generateTextStream({
        messages,
        temperature: 0.3,
        maxRetries: 2,
        reasoningEffort,
        signal,
      })) {
        if (signal?.aborted) {
          throw Object.assign(new Error('Task aborted'), { name: 'AbortError' })
        }
        fullText += c.text
        if (onToken) await onToken()
      }
    } else {
      const result = await runtime.generateText({
        messages,
        temperature: 0.3,
        maxRetries: 2,
        reasoningEffort,
        signal,
      })
      fullText = result.text
    }

    return this.parseModelJson<{
      sourceLang: string
      translations: Record<string, string>
    }>(fullText, 'callChunkTranslation')
  }

  async generateTranslation(
    articleId: string,
    targetLang: string,
    onToken?: (count?: number) => Promise<void>,
    signal?: AbortSignal,
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
        signal,
      )
      const translated = await result
      this.logger.log(
        `AI translation done: article=${articleId} target=${targetLang} ms=${
          Date.now() - startedAt
        }`,
      )
      return translated
    } catch (error) {
      if (error instanceof BizException || error.name === 'AbortError') {
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
    signal?: AbortSignal,
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
          signal,
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
          existing.contentFormat = translated.contentFormat
          existing.content = translated.content
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
          contentFormat: translated.contentFormat,
          content: translated.content,
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
      scope: EventScope.TO_SYSTEM_VISITOR,
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
      content?: string
    },
  ) {
    const doc = await this.aiTranslationModel.findById(id)
    if (!doc) {
      throw new BizException(ErrorCodeEnum.AITranslationNotFound)
    }

    if (data.title !== undefined) doc.title = data.title
    if (data.summary !== undefined) doc.summary = data.summary
    if (data.tags !== undefined) doc.tags = data.tags

    if (data.content !== undefined) {
      doc.content = data.content
      doc.text = this.lexicalService.lexicalToMarkdown(data.content)
    } else if (data.text !== undefined) {
      doc.text = data.text
    }

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

  async getValidTranslationsByRefId(
    refId: string,
    document: PostModel | NoteModel | PageModel,
  ): Promise<AITranslationModel[]> {
    const translations = await this.aiTranslationModel.find({ refId })
    if (!translations.length) return []

    const sourceLang =
      this.getMetaLang(document) || translations[0]?.sourceLang || 'unknown'
    const currentHash = this.computeContentHash(
      this.toArticleContent(document as ArticleDocument),
      sourceLang,
    )

    return translations.filter((t) => t.hash === currentHash)
  }

  @OnEvent(BusinessEvents.POST_DELETE)
  @OnEvent(BusinessEvents.NOTE_DELETE)
  @OnEvent(BusinessEvents.PAGE_DELETE)
  async handleDeleteArticle(event: ArticleEventPayload) {
    const id = this.extractIdFromEvent(event)
    if (!id) return
    await this.deleteTranslationsByRefId(id)
  }

  async scheduleRegenerationForStaleTranslations(
    articleIds: string[],
    targetLang: string,
  ) {
    if (!articleIds.length) return

    const aiConfig = await this.configService.get('ai')
    if (
      !aiConfig.enableAutoGenerateTranslation ||
      !aiConfig.enableTranslation
    ) {
      return
    }

    const existingTranslations = await this.aiTranslationModel
      .find({
        refId: { $in: articleIds },
        lang: targetLang,
      })
      .select('refId')
      .lean()

    if (!existingTranslations.length) return

    const staleRefIds = [...new Set(existingTranslations.map((t) => t.refId))]

    for (const refId of staleRefIds) {
      this.logger.log(
        `Scheduling stale translation regeneration: article=${refId} lang=${targetLang}`,
      )
      await this.aiTaskService.createTranslationTask({
        refId,
        targetLanguages: [targetLang],
      })
    }
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

    await this.cancelActiveTranslationTasks(id)

    this.logger.log(
      `AI auto translation task created: article=${id} targets=${targetLanguages.join(',')}`,
    )
    await this.aiTaskService.createTranslationTask({
      refId: id,
      targetLanguages,
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
      await this.cancelActiveTranslationTasks(id)
      this.logger.log(
        `AI auto translation task created (update init): article=${id} targets=${targetLanguages.join(',')}`,
      )
      await this.aiTaskService.createTranslationTask({
        refId: id,
        targetLanguages,
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

    await this.cancelActiveTranslationTasks(id)
    this.logger.log(
      `AI auto translation task created (update): article=${id} targets=${outdatedLanguages.join(',')}`,
    )
    await this.aiTaskService.createTranslationTask({
      refId: id,
      targetLanguages: outdatedLanguages,
    })
  }
}
