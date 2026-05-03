import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common'

import { BizException } from '~/common/exceptions/biz.exception'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { CollectionRefTypes } from '~/constants/db.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { DatabaseService } from '~/processors/database/database.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { LexicalService } from '~/processors/helper/helper.lexical.service'
import {
  type TaskExecuteContext,
  TaskQueueProcessor,
  TaskStatus,
} from '~/processors/task-queue'
import { ContentFormat } from '~/shared/types/content-format.type'
import { createAbortError } from '~/utils/abort.util'
import { md5 } from '~/utils/tool.util'

import { ConfigsService } from '../../configs/configs.service'
import {
  AI_STREAM_IDLE_TIMEOUT_MS,
  AI_STREAM_LOCK_TTL,
  AI_STREAM_MAXLEN,
  AI_STREAM_READ_BLOCK_MS,
  AI_STREAM_RESULT_TTL,
} from '../ai.constants'
import { AiService } from '../ai.service'
import { AiInFlightService } from '../ai-inflight/ai-inflight.service'
import type { AiStreamEvent } from '../ai-inflight/ai-inflight.types'
import { resolveTargetLanguages } from '../ai-language.util'
import { AiTaskService } from '../ai-task/ai-task.service'
import {
  AITaskType,
  computeAITaskDedupKey,
  type TranslationAllTaskPayload,
  type TranslationBatchTaskPayload,
  type TranslationTaskPayload,
} from '../ai-task/ai-task.types'
import {
  AiTranslationRepository,
  type AiTranslationRow,
} from './ai-translation.repository'
import type { GetTranslationsGroupedQueryInput } from './ai-translation.schema'
import type {
  ArticleContent,
  ArticleDocument,
  ArticleEventDocument,
  ArticleEventPayload,
} from './ai-translation.types'
import { AITranslationModel } from './ai-translation.types-model'
import { BaseTranslationService } from './base-translation.service'
import { TranslationConsistencyService } from './translation-consistency.service'
import type { TranslationSourceSnapshot } from './translation-consistency.types'
import type { ITranslationStrategy } from './translation-strategy.interface'
import {
  LEXICAL_TRANSLATION_STRATEGY,
  MARKDOWN_TRANSLATION_STRATEGY,
} from './translation-strategy.interface'

function isDataEvent(event: ArticleEventPayload): event is { data: string } {
  return 'data' in event
}

function isIdEvent(event: ArticleEventPayload): event is { id: string } {
  return 'id' in event && typeof (event as { id?: unknown }).id === 'string'
}

const TRANSLATION_LANGUAGE_CONCURRENCY = 3

/**
 * Run an async mapper over `items` with bounded concurrency, preserving the
 * input order in the returned results array.
 */
async function runWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = Array.from({ length: items.length })
  let cursor = 0
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (true) {
        const index = cursor++
        if (index >= items.length) return
        results[index] = await fn(items[index], index)
      }
    },
  )
  await Promise.all(workers)
  return results
}

@Injectable()
export class AiTranslationService
  extends BaseTranslationService
  implements OnModuleInit
{
  private readonly logger = new Logger(AiTranslationService.name)
  private readonly aiTranslationModel: any

  constructor(
    private readonly aiTranslationRepository: AiTranslationRepository,
    private readonly databaseService: DatabaseService,
    private readonly translationConsistencyService: TranslationConsistencyService,
    private readonly configService: ConfigsService,
    private readonly aiService: AiService,
    private readonly aiInFlightService: AiInFlightService,
    private readonly eventManager: EventManagerService,
    private readonly taskProcessor: TaskQueueProcessor,
    private readonly lexicalService: LexicalService,
    private readonly aiTaskService: AiTaskService,
    @Inject(LEXICAL_TRANSLATION_STRATEGY)
    private readonly lexicalStrategy: ITranslationStrategy,
    @Inject(MARKDOWN_TRANSLATION_STRATEGY)
    private readonly markdownStrategy: ITranslationStrategy,
  ) {
    super()
    this.aiTranslationModel = this.createTranslationModelAdapter()
  }

  private toTranslationDoc(
    row: AiTranslationRow | null,
  ): AITranslationModel | null {
    if (!row) return null
    const repo = this.aiTranslationRepository
    return {
      ...row,
      _id: row.id,
      createdAt: row.createdAt,
      save() {
        return repo.updateById(row.id, this as any)
      },
    } as unknown as AITranslationModel
  }

  private toTranslationDocs(rows: AiTranslationRow[]): AITranslationModel[] {
    return rows.map((row) => this.toTranslationDoc(row)!)
  }

  private createTranslationQuery(rowsPromise: Promise<AiTranslationRow[]>) {
    const toDocs = (rows: AiTranslationRow[]) => this.toTranslationDocs(rows)
    const query: any = {
      sort: () => query,
      select: () => query,
      limit: () => query,
      lean: () => rowsPromise.then(toDocs),
      exec: () => rowsPromise.then(toDocs),
      then: (resolve: any, reject: any) =>
        rowsPromise.then(toDocs).then(resolve, reject),
    }
    return query
  }

  private createTranslationModelAdapter() {
    const repo = this.aiTranslationRepository
    const toDoc = (r: AiTranslationRow | null) => this.toTranslationDoc(r)
    const toDocs = (rs: AiTranslationRow[]) => this.toTranslationDocs(rs)
    const createQuery = (p: Promise<AiTranslationRow[]>) =>
      this.createTranslationQuery(p)
    return {
      findOne: (query: any) => {
        const promise =
          query?.refId && query?.refType && query?.lang
            ? repo.findByRef(query.refId, query.refType, query.lang)
            : repo
                .listByRefId(query?.refId)
                .then(
                  (rows) =>
                    rows.find((row) =>
                      Object.entries(query ?? {}).every(
                        ([key, value]) => (row as any)[key] === value,
                      ),
                    ) ?? null,
                )
        const queryApi: any = {
          select: () => queryApi,
          lean: () => promise.then(toDoc),
          then: (resolve: any, reject: any) =>
            promise.then(toDoc).then(resolve, reject),
        }
        return queryApi
      },
      find: (query: any = {}) => {
        if (query.refId?.$in) {
          return createQuery(repo.listByRefIds(query.refId.$in))
        }
        if (query.refId) {
          return createQuery(repo.listByRefId(query.refId))
        }
        return createQuery(repo.list(1, 100).then((r) => r.data))
      },
      findById: (id: string) => repo.findById(id).then(toDoc),
      create: async (input: any) => toDoc(await repo.upsert(input)),
      deleteOne: async (query: any) => {
        if (query?.id) {
          const deletedCount = await repo.deleteById(query.id)
          return { deletedCount }
        }
        return { deletedCount: 0 }
      },
      deleteMany: async (query: any) => {
        if (query?.refId && query?.refType) {
          const deletedCount = await repo.deleteForRef(
            query.refId,
            query.refType,
          )
          return { deletedCount }
        }
        if (query?.refId) {
          const deletedCount = await repo.deleteForRefId(query.refId)
          return { deletedCount }
        }
        return { deletedCount: 0 }
      },
      paginate: async (_query: any, options: any) => {
        const result = await repo.list(options?.page ?? 1, options?.limit ?? 20)
        return {
          docs: toDocs(result.data),
          totalDocs: result.pagination.total,
          page: result.pagination.currentPage,
          totalPages: result.pagination.totalPage,
          limit: result.pagination.size,
          hasNextPage: result.pagination.hasNextPage,
          hasPrevPage: result.pagination.hasPrevPage,
        }
      },
      aggregate: async () => [],
    }
  }

  private getStrategy(contentFormat?: string | null): ITranslationStrategy {
    return contentFormat === ContentFormat.Lexical
      ? this.lexicalStrategy
      : this.markdownStrategy
  }

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

  // NOTE: `executeTranslationTask` and `executeTranslationAllTask` share a
  // surface-level "loop + checkAborted + appendLog + updateProgress" shape, but
  // their per-iteration semantics differ enough to keep them apart:
  //   - this method tracks per-language failures + sets PartialFailed/Failed
  //     status, updates progress every iteration, and wraps each call in
  //     try/catch with re-throw on AbortError;
  //   - `executeTranslationAllTask` has no per-iteration try/catch (createTask
  //     never throws here), throttles progress updates to every 10 items, and
  //     reports `createdCount` rather than success/fail counts.
  // Extracting `forEachWithProgress` would force callers to thread these as
  // options and would make both call sites harder to read than they are now.
  private async executeTranslationTask(
    payload: TranslationTaskPayload,
    context: TaskExecuteContext,
  ) {
    this.checkAborted(context)

    const aiConfig = await this.configService.get('ai')
    const languages = resolveTargetLanguages(
      payload.targetLanguages,
      aiConfig.translationTargetLanguages,
    )

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
          translationId: result.id!,
          lang: result.lang,
          title: result.title,
        })
      } catch (error: any) {
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
    const articleMap = this.mapArticlesByRefId(articles)

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
    const languages = resolveTargetLanguages(
      payload.targetLanguages,
      aiConfig.translationTargetLanguages,
    )

    if (!languages.length) {
      await context.appendLog('warn', 'No target languages specified')
      return
    }

    await context.appendLog('info', 'Fetching all articles for translation')

    // TODO(wave 3 follow-up): provide producer-level list methods for the
    // translation-all task. The direct Mongo model router has been removed.
    const [posts, notes, pages] = (await Promise.all([[], [], []])) as Array<
      Array<{ id: string; title: string }>
    >

    const articleMap = this.mapArticlesByRefId({
      posts: posts.map((p) => ({ id: p.id, title: p.title })),
      notes: notes.map((n) => ({ id: n.id, title: n.title })),
      pages: pages.map((p) => ({ id: p.id, title: p.title })),
    })

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

  // Article ref-type is normalized to `CollectionRefTypes` enum values
  // everywhere (post/note/page collection names), avoiding 'Post'/'Note'/'Page'
  // string literals that previously diverged from the enum form.
  private mapArticlesByRefId(articles: {
    posts: Array<{ id: string; title: string }>
    notes: Array<{ id: string; title: string }>
    pages: Array<{ id: string; title: string }>
  }): Map<string, { title: string; type: CollectionRefTypes }> {
    const map = new Map<string, { title: string; type: CollectionRefTypes }>()
    for (const post of articles.posts) {
      map.set(post.id, { title: post.title, type: CollectionRefTypes.Post })
    }
    for (const note of articles.notes) {
      map.set(note.id, { title: note.title, type: CollectionRefTypes.Note })
    }
    for (const page of articles.pages) {
      map.set(page.id, { title: page.title, type: CollectionRefTypes.Page })
    }
    return map
  }

  private checkAborted(context: TaskExecuteContext) {
    if (context.isAborted()) {
      throw createAbortError()
    }
  }

  async cancelActiveTranslationTasks(refId: string) {
    const results = await Promise.all(
      [TaskStatus.Running, TaskStatus.Pending].map((status) =>
        this.aiTaskService.crud.getTasks({
          type: AITaskType.Translation,
          status,
          page: 1,
          size: 100,
          includeSubTasks: true,
        }),
      ),
    )
    const tasks = results.flatMap((r) => r.data)
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

  extractIdFromEvent(event: ArticleEventPayload): string | null {
    if (isDataEvent(event)) {
      return event.data ?? null
    }
    if (isIdEvent(event)) {
      return event.id
    }
    const doc = event as ArticleEventDocument
    if (typeof doc.id === 'string') {
      return doc.id
    }
    return (doc.id as { toString?: () => string })?.toString?.() ?? null
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
      yield { type: 'done' as const, data: { resultId: translation.id! } }
    })()

    return {
      events,
      result: Promise.resolve(translation),
    }
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
        subtitle: content.subtitle ?? null,
        summary: content.summary ?? null,
        tags: content.tags ?? null,
      }),
    )
  }

  private buildSourceSnapshots(
    content: ArticleContent,
  ): AITranslationModel['sourceBlockSnapshots'] {
    if (content.contentFormat !== ContentFormat.Lexical || !content.content) {
      return undefined
    }
    return this.lexicalService.extractRootBlocks(content.content).map((b) => ({
      id: b.id ?? '',
      fingerprint: b.fingerprint,
      type: b.type,
      index: b.index,
    }))
  }

  private buildSourceMetaHashes(
    content: ArticleContent,
  ): AITranslationModel['sourceMetaHashes'] {
    return {
      title: md5(content.title),
      subtitle: content.subtitle ? md5(content.subtitle) : undefined,
      summary: content.summary ? md5(content.summary) : undefined,
      tags: content.tags?.length ? md5(content.tags.join('|||')) : undefined,
    }
  }
  private async translateContentStream(
    content: ArticleContent,
    targetLang: string,
    push?: (event: AiStreamEvent) => Promise<void>,
    onToken?: (count?: number) => Promise<void>,
    signal?: AbortSignal,
    existing?: AITranslationModel | null,
  ) {
    const { runtime, info } = await this.aiService.getTranslationModelWithInfo()
    const strategy = this.getStrategy(content.contentFormat)
    return strategy.translate(content, targetLang, runtime, info, {
      push,
      onToken,
      signal,
      existing,
    })
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
    } catch (error: any) {
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
    const sourceModified = document.modifiedAt ?? undefined
    const key = this.buildTranslationKey(articleId, targetLang, content)

    return this.aiInFlightService.runWithStream<AITranslationModel>({
      key,
      lockTtlSec: AI_STREAM_LOCK_TTL,
      resultTtlSec: AI_STREAM_RESULT_TTL,
      streamMaxLen: AI_STREAM_MAXLEN,
      readBlockMs: AI_STREAM_READ_BLOCK_MS,
      idleTimeoutMs: AI_STREAM_IDLE_TIMEOUT_MS,
      onLeader: async ({ push }) => {
        // Fetch existing translation for incremental path
        const existing = await this.aiTranslationModel.findOne({
          refId: articleId,
          refType,
          lang: targetLang,
        })

        const translated = await this.translateContentStream(
          content,
          targetLang,
          push,
          onToken,
          signal,
          existing,
        )
        const { sourceLang } = translated
        const hash = this.computeContentHash(content, sourceLang)

        // Build source snapshots for future incremental translations
        const sourceSnapshots = this.buildSourceSnapshots(content)
        const sourceMetaHashes = this.buildSourceMetaHashes(content)

        if (existing) {
          existing.hash = hash
          existing.sourceLang = sourceLang
          existing.title = translated.title
          existing.text = translated.text
          existing.subtitle = translated.subtitle ?? undefined
          existing.summary = translated.summary ?? undefined
          existing.tags = translated.tags ?? undefined
          existing.contentFormat = translated.contentFormat
          existing.content = translated.content
          if (sourceModified) {
            existing.sourceModified = sourceModified
          }
          existing.aiModel = translated.aiModel
          existing.aiProvider = translated.aiProvider
          existing.sourceBlockSnapshots = sourceSnapshots
          existing.sourceMetaHashes = sourceMetaHashes
          await existing.save()
          this.logger.log(
            `AI translation updated: article=${articleId} target=${targetLang}`,
          )

          this.emitTranslationEvent(BusinessEvents.TRANSLATION_UPDATE, existing)

          return { result: existing, resultId: existing.id! }
        }

        const created = await this.aiTranslationModel.create({
          hash,
          refId: articleId,
          refType,
          lang: targetLang,
          sourceLang,
          title: translated.title,
          text: translated.text,
          subtitle: translated.subtitle ?? undefined,
          summary: translated.summary ?? undefined,
          tags: translated.tags ?? undefined,
          contentFormat: translated.contentFormat,
          content: translated.content,
          sourceModified,
          aiModel: translated.aiModel,
          aiProvider: translated.aiProvider,
          sourceBlockSnapshots: sourceSnapshots,
          sourceMetaHashes,
        })
        this.logger.log(
          `AI translation created: article=${articleId} target=${targetLang}`,
        )

        this.emitTranslationEvent(BusinessEvents.TRANSLATION_CREATE, created)

        return { result: created, resultId: created.id! }
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
    // `translation` can be a live persistence object. Its array fields may carry
    // non-cloneable internals that fail the gateway's `structuredClone()`.
    // Materialize `tags` into a plain array before emitting.
    const tags = Array.isArray(translation.tags)
      ? [...translation.tags]
      : translation.tags

    const payload = {
      id: translation.id,
      refId: translation.refId,
      refType: translation.refType,
      lang: translation.lang,
      sourceLang: translation.sourceLang,
      title: translation.title,
      text: translation.text,
      subtitle: translation.subtitle,
      summary: translation.summary,
      tags,
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
    const languages = resolveTargetLanguages(
      targetLanguages,
      aiConfig.translationTargetLanguages,
    )

    if (!languages.length) {
      return []
    }

    const settled = await runWithConcurrency(
      languages,
      TRANSLATION_LANGUAGE_CONCURRENCY,
      async (lang) => {
        try {
          return await this.generateTranslation(articleId, lang)
        } catch (error: any) {
          this.logger.error(
            `Failed to generate translation for ${articleId} to ${lang}: ${error.message}`,
          )
          return null
        }
      },
    )

    return settled.filter((t): t is AITranslationModel => t !== null)
  }

  async findCachedTitlesByRefIds(
    refIds: string[],
    lang: string,
  ): Promise<Map<string, string>> {
    if (!refIds.length || !lang) return new Map()
    const rows = await this.aiTranslationModel
      .find({ refId: { $in: refIds }, lang })
      .select('refId title')
      .lean()
    const map = new Map<string, string>()
    for (const row of rows) {
      if (row.refId && row.title) {
        map.set(row.refId, row.title)
      }
    }
    return map
  }

  async getTranslationsByRefId(refId: string) {
    const [article, translations] = await Promise.all([
      this.databaseService.findGlobalById(refId),
      this.aiTranslationModel.find({ refId }),
    ])
    if (!article) {
      throw new BizException(ErrorCodeEnum.ContentNotFound)
    }

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
    const { page, size } = query

    const matchedRefIds: string[] | null = null

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
    const [translations, articles] = await Promise.all([
      this.aiTranslationModel
        .find({ refId: { $in: refIds } })
        .sort({ created: -1 })
        .lean(),
      this.databaseService.findGlobalByIds(refIds),
    ])

    const articleMap = this.mapArticlesByRefId(articles)

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
        const info = articleMap.get(refId)
        if (!info) return null
        return {
          article: { id: refId, title: info.title, type: info.type },
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
      subtitle?: string | null
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
    if (data.subtitle !== undefined) doc.subtitle = data.subtitle ?? undefined
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

    const document = article.document as ArticleDocument
    const translation = await this.aiTranslationModel.findOne({
      refId: articleId,
      lang: targetLang,
    })

    if (!translation) {
      return null
    }

    const snapshot = this.buildSnapshotFromDocument(articleId, document)
    const status =
      this.translationConsistencyService.evaluateTranslationFreshness(
        snapshot,
        translation,
      )

    return status === 'valid' ? translation : null
  }

  async getValidTranslationsForArticles(
    articles: TranslationSourceSnapshot[],
    targetLang: string,
    options?: {
      select?: string
    },
  ): Promise<{
    validTranslations: Map<string, AITranslationModel>
    staleRefIds: string[]
  }> {
    if (!articles.length) {
      return { validTranslations: new Map(), staleRefIds: [] }
    }

    const select = this.translationConsistencyService.buildValidationSelect(
      options?.select,
    )

    const query = this.aiTranslationModel.find({
      refId: { $in: articles.map((article) => article.id) },
      lang: targetLang,
    })

    query.select(select)

    const translations = await query

    if (!translations.length) {
      return { validTranslations: new Map(), staleRefIds: [] }
    }

    const result =
      this.translationConsistencyService.partitionValidAndStaleTranslations(
        articles,
        translations,
      )

    if (result.unknownTranslations.size) {
      const unknownTranslations = [...result.unknownTranslations.values()]
      const trulyStaleRefIds =
        await this.translationConsistencyService.filterTrulyStaleTranslations(
          unknownTranslations,
        )
      const trulyStaleRefIdSet = new Set(trulyStaleRefIds)

      for (const [refId, translation] of result.unknownTranslations) {
        if (trulyStaleRefIdSet.has(refId)) {
          if (!result.staleRefIds.includes(refId)) {
            result.staleRefIds.push(refId)
          }
          continue
        }

        result.validTranslations.set(refId, translation)
      }
    }

    if (result.staleRefIds.length) {
      this.scheduleRegenerationForStaleTranslations(
        result.staleRefIds,
        targetLang,
      ).catch((err) =>
        this.logger.error(
          'Failed to schedule stale translation regeneration',
          err,
        ),
      )
    }

    return result
  }

  async getAvailableLanguagesForArticle(articleId: string): Promise<string[]> {
    const article = await this.databaseService.findGlobalById(articleId)
    if (!article || !article.document || !this.isArticleVisible(article)) {
      return []
    }

    const document = article.document as ArticleDocument
    const translations = await this.aiTranslationModel
      .find({ refId: articleId })
      .select('hash lang sourceLang sourceModified created')

    if (!translations.length) {
      return []
    }

    const snapshot = this.buildSnapshotFromDocument(articleId, document)

    return translations
      .filter(
        (t) =>
          this.translationConsistencyService.evaluateTranslationFreshness(
            snapshot,
            t,
          ) === 'valid',
      )
      .map((t) => t.lang)
  }

  private buildSnapshotFromDocument(
    articleId: string,
    document: ArticleDocument,
  ): TranslationSourceSnapshot {
    return {
      id: articleId,
      title: document.title,
      text: document.text,
      subtitle:
        'subtitle' in document ? (document.subtitle ?? undefined) : undefined,
      summary:
        'summary' in document ? (document.summary ?? undefined) : undefined,
      tags: 'tags' in document ? document.tags : undefined,
      meta: (document.meta ?? undefined) as { lang?: string } | undefined,
      contentFormat: document.contentFormat,
      content: document.content,
      modifiedAt: document.modifiedAt,
      createdAt: document.createdAt,
    }
  }

  async getTranslationAndAvailableLanguages(
    articleId: string,
    targetLang?: string,
    options?: { ignoreVisibility?: boolean },
  ): Promise<{
    availableTranslations: string[]
    sourceLang: string | null
    translation: AITranslationModel | null
  }> {
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

    const document = article.document as ArticleDocument
    const translations = await this.aiTranslationModel
      .find({ refId: articleId })
      .select('hash lang sourceLang sourceModified created')

    if (!translations.length) {
      return { availableTranslations: [], sourceLang: null, translation: null }
    }

    const sourceLang = translations[0]?.sourceLang ?? null

    const snapshot = this.buildSnapshotFromDocument(articleId, document)
    const validLangs: string[] = []
    const staleLangs: string[] = []

    for (const t of translations) {
      const status =
        this.translationConsistencyService.evaluateTranslationFreshness(
          snapshot,
          t,
        )
      if (status === 'valid') {
        validLangs.push(t.lang)
      } else if (status === 'stale') {
        staleLangs.push(t.lang)
      }
    }

    const matchedTranslation =
      targetLang && validLangs.includes(targetLang)
        ? await this.aiTranslationModel.findOne({
            refId: articleId,
            lang: targetLang,
          })
        : null

    if (staleLangs.length && targetLang) {
      this.scheduleRegenerationForStaleTranslations(
        [articleId],
        targetLang,
      ).catch((err) =>
        this.logger.error(
          'Failed to schedule stale translation regeneration',
          err,
        ),
      )
    }

    return {
      availableTranslations: validLangs,
      sourceLang,
      translation: matchedTranslation,
    }
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
      .select('refId hash sourceLang')
      .lean()

    if (!existingTranslations.length) return

    const staleRefIds =
      await this.translationConsistencyService.filterTrulyStaleTranslations(
        existingTranslations,
      )
    if (!staleRefIds.length) return

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
}
