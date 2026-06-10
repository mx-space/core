import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import removeMdCodeblock from 'remove-md-codeblock'

import { AppErrorCode, createAppException } from '~/common/errors'
import { AppException } from '~/common/errors/exception.types'
import { BusinessEvents } from '~/constants/business-event.constant'
import { CollectionRefTypes } from '~/constants/db.constant'
import { paginationOf } from '~/processors/database/base.repository'
import { DatabaseService } from '~/processors/database/database.service'
import {
  type TaskExecuteContext,
  TaskQueueProcessor,
  TaskStatus,
} from '~/processors/task-queue'
import type { BasicPagerInput } from '~/shared/dto/pager.dto'
import { createAbortError } from '~/utils/abort.util'
import { md5 } from '~/utils/tool.util'

import { ConfigsService } from '../../configs/configs.service'
import {
  AI_STREAM_IDLE_TIMEOUT_MS,
  AI_STREAM_LOCK_TTL,
  AI_STREAM_MAXLEN,
  AI_STREAM_READ_BLOCK_MS,
  AI_STREAM_RESULT_TTL,
  DEFAULT_SUMMARY_LANG,
} from '../ai.constants'
import { AI_PROMPTS } from '../ai.prompts'
import { AiService } from '../ai.service'
import { AiInFlightService } from '../ai-inflight/ai-inflight.service'
import type { AiStreamEvent } from '../ai-inflight/ai-inflight.types'
import { resolveTargetLanguages } from '../ai-language.util'
import { AiTaskService } from '../ai-task/ai-task.service'
import { AITaskType, type SummaryTaskPayload } from '../ai-task/ai-task.types'
import { AiSummaryRepository } from './ai-summary.repository'
import type { GetSummariesGroupedQueryInput } from './ai-summary.schema'
import type { AiSummaryRow } from './ai-summary.types'
import { AISummaryModel } from './ai-summary.types'

@Injectable()
export class AiSummaryService implements OnModuleInit {
  private readonly logger: Logger
  constructor(
    private readonly aiSummaryRepository: AiSummaryRepository,
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigsService,

    private readonly aiService: AiService,
    private readonly aiInFlightService: AiInFlightService,
    private readonly taskProcessor: TaskQueueProcessor,
    private readonly aiTaskService: AiTaskService,
  ) {
    this.logger = new Logger(AiSummaryService.name)
  }

  onModuleInit() {
    this.registerTaskHandler()
  }

  private registerTaskHandler() {
    this.taskProcessor.registerHandler({
      type: AITaskType.Summary,
      execute: async (
        payload: SummaryTaskPayload,
        context: TaskExecuteContext,
      ) => {
        this.checkAborted(context)

        const aiConfig = await this.configService.get('ai')
        const languages = resolveTargetLanguages(
          payload.targetLanguages,
          aiConfig.summaryTargetLanguages,
        )

        if (!languages.length) {
          await context.appendLog('warn', 'No target languages specified')
          return
        }

        await context.updateProgress(
          0,
          'Starting summary generation',
          0,
          languages.length,
        )

        const summaries: Array<{
          summaryId: string
          lang: string
          summary: string
        }> = []

        let failedCount = 0

        for (let i = 0; i < languages.length; i++) {
          this.checkAborted(context)

          const lang = languages[i]
          await context.appendLog(
            'info',
            `Generating summary in ${lang} (${i + 1}/${languages.length})`,
          )

          try {
            const result = await this.generateSummaryByOpenAI(
              payload.refId,
              lang,
              context.incrementTokens,
              context.incrementCost,
            )
            summaries.push({
              summaryId: result.id!,
              lang: result.lang!,
              summary: result.summary,
            })
          } catch (error) {
            if (error.name === 'AbortError') throw error
            failedCount++
            await context.appendLog(
              'error',
              `Failed to generate summary in ${lang}: ${error.message}`,
            )
          }

          const progress = Math.round(((i + 1) / languages.length) * 100)
          await context.updateProgress(
            progress,
            `Generated ${i + 1}/${languages.length}`,
            i + 1,
            languages.length,
          )
        }

        await context.setResult({ summaries })

        if (failedCount === languages.length) {
          context.setStatus(TaskStatus.Failed)
        } else if (failedCount > 0) {
          context.setStatus(TaskStatus.PartialFailed)
        }
      },
    })

    this.logger.log('AI summary task handler registered')
  }

  private checkAborted(context: TaskExecuteContext) {
    if (context.isAborted()) {
      throw createAbortError()
    }
  }

  private serializeText(text: string) {
    return removeMdCodeblock(text)
  }

  private buildSummaryKey(articleId: string, lang: string, text: string) {
    return md5(
      JSON.stringify({
        feature: 'summary',
        articleId,
        lang,
        textHash: md5(text),
      }),
    )
  }

  /**
   * Compute a content hash used to detect whether the content has changed.
   */
  private computeContentHash(text: string): string {
    return md5(this.serializeText(text))
  }

  private toSummaryDoc(row: AiSummaryRow | null): AISummaryModel | null {
    if (!row) return null
    return {
      ...row,
      createdAt: row.createdAt,
    } as unknown as AISummaryModel
  }

  private toSummaryDocs(rows: AiSummaryRow[]): AISummaryModel[] {
    return rows.map((row) => this.toSummaryDoc(row)!)
  }

  /**
   * Fetch and validate an article for summary-related operations.
   */
  private async resolveArticleForSummary(articleId: string): Promise<{
    document: { text: string; title: string }
    type: CollectionRefTypes.Post | CollectionRefTypes.Note
  }> {
    const article = await this.databaseService.findGlobalById(articleId)
    if (!article || !article.document) {
      throw createAppException(AppErrorCode.CONTENT_NOT_FOUND_CANT_PROCESS)
    }

    if (
      article.type === CollectionRefTypes.Recently ||
      article.type === CollectionRefTypes.Page
    ) {
      throw createAppException(AppErrorCode.CONTENT_NOT_FOUND_CANT_PROCESS)
    }

    return {
      document: article.document,
      type: article.type,
    }
  }

  /**
   * Check whether a valid summary with a matching hash already exists in the database.
   */
  private async findValidSummary(
    articleId: string,
    lang: string,
    text: string,
  ): Promise<AISummaryModel | null> {
    const contentHash = this.computeContentHash(text)

    return this.toSummaryDoc(
      await this.aiSummaryRepository.findByHash(articleId, contentHash, lang),
    )
  }

  /**
   * Wrap an existing summary in the stream format so it can be returned immediately.
   */
  private wrapAsImmediateStream(summary: AISummaryModel): {
    events: AsyncIterable<AiStreamEvent>
    result: Promise<AISummaryModel>
  } {
    const events = (async function* () {
      yield { type: 'done' as const, data: { resultId: summary.id! } }
    })()

    return {
      events,
      result: Promise.resolve(summary),
    }
  }

  private async generateSummaryViaAIStream(
    text: string,
    lang: string,
    push?: (event: AiStreamEvent) => Promise<void>,
    onToken?: (count?: number) => Promise<void>,
    onCost?: (usd: number) => Promise<void>,
  ) {
    const runtime = await this.aiService.getSummaryModel()
    const { systemPrompt, prompt, reasoningEffort } = AI_PROMPTS.summaryStream(
      lang,
      text,
    )

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: prompt },
    ]

    let fullText = ''
    let totalTokens = 0
    let totalCost = 0
    if (runtime.streamMessage) {
      const events = runtime.streamMessage({
        messages,
        temperature: 0.5,
        maxRetries: 2,
        reasoningEffort,
      })
      for await (const event of events) {
        if (event.type === 'text_delta') {
          const delta = event.delta
          if (typeof delta !== 'string' || delta.length === 0) continue
          fullText += delta
          if (push) {
            await push({ type: 'token', data: delta })
          }
        } else if (
          event.type === 'thinking_delta' ||
          event.type === 'toolcall_start' ||
          event.type === 'toolcall_delta' ||
          event.type === 'toolcall_end'
        ) {
          this.logger.debug(`stream non-text event filtered: ${event.type}`)
        } else if (event.type === 'done') {
          totalTokens = event.message.usage?.totalTokens ?? 0
          totalCost = event.message.usage?.cost?.total ?? 0
        } else if (event.type === 'error') {
          throw new Error(event.error.errorMessage || 'AI summary stream error')
        }
      }
    } else {
      const result = await runtime.generateText({
        messages,
        temperature: 0.5,
        maxRetries: 2,
        reasoningEffort,
      })
      fullText = result.text
      totalTokens = result.usage?.totalTokens ?? 0
      totalCost = result.usage?.cost ?? 0
      if (push && result.text) {
        await push({ type: 'token', data: result.text })
      }
    }

    const parsed = JSON.parse(fullText) as { summary?: string }
    if (!parsed?.summary || typeof parsed.summary !== 'string') {
      throw new Error('Invalid summary JSON response')
    }

    if (onToken) {
      await onToken(totalTokens)
    }
    if (onCost && totalCost > 0) {
      await onCost(totalCost)
    }

    return { summary: parsed.summary, rawText: fullText }
  }

  private async runSummaryGeneration(
    articleId: string,
    lang: string,
    document: { text: string },
    onToken?: (count?: number) => Promise<void>,
    onCost?: (usd: number) => Promise<void>,
  ) {
    const text = this.serializeText(document.text)
    const key = this.buildSummaryKey(articleId, lang, text)

    return this.aiInFlightService.runWithStream<AISummaryModel>({
      key,
      lockTtlSec: AI_STREAM_LOCK_TTL,
      resultTtlSec: AI_STREAM_RESULT_TTL,
      streamMaxLen: AI_STREAM_MAXLEN,
      readBlockMs: AI_STREAM_READ_BLOCK_MS,
      idleTimeoutMs: AI_STREAM_IDLE_TIMEOUT_MS,
      onLeader: async ({ push }) => {
        const { summary } = await this.generateSummaryViaAIStream(
          text,
          lang,
          push,
          onToken,
          onCost,
        )
        const contentMd5 = md5(text)

        const doc = this.toSummaryDoc(
          await this.aiSummaryRepository.upsert({
            refId: articleId,
            hash: contentMd5,
            summary,
            lang,
          }),
        )!

        return { result: doc, resultId: doc.id! }
      },
      parseResult: async (resultId) => {
        const doc = this.toSummaryDoc(
          await this.aiSummaryRepository.findById(resultId),
        )
        if (!doc) {
          throw createAppException(AppErrorCode.CONTENT_NOT_FOUND_CANT_PROCESS)
        }
        return doc
      },
    })
  }

  async generateSummaryByOpenAI(
    articleId: string,
    lang: string,
    onToken?: (count?: number) => Promise<void>,
    onCost?: (usd: number) => Promise<void>,
  ) {
    const {
      ai: { enableSummary },
    } = await this.configService.waitForConfigReady()

    if (!enableSummary) {
      throw createAppException(AppErrorCode.AI_NOT_ENABLED)
    }

    const { document } = await this.resolveArticleForSummary(articleId)

    try {
      const { result } = await this.runSummaryGeneration(
        articleId,
        lang,
        document,
        onToken,
        onCost,
      )
      return await result
    } catch (error) {
      if (error instanceof AppException) {
        throw error
      }
      this.logger.error(
        `OpenAI failed while processing article ${articleId}: ${error.message}`,
        error.stack,
      )
      throw createAppException(AppErrorCode.AI_SERVICE_ERROR, {
        message: error.message,
      })
    }
  }

  async batchGetSummariesByRefIds(
    refIds: string[],
    lang = DEFAULT_SUMMARY_LANG,
  ): Promise<Map<string, string>> {
    if (!refIds.length) return new Map()

    const summaries = await this.aiSummaryRepository.listByRefIds(refIds, lang)

    const map = new Map<string, string>()
    for (const s of summaries) {
      if (!map.has(s.refId)) {
        map.set(s.refId, s.summary)
      }
    }
    return map
  }

  async getSummariesByRefId(refId: string) {
    const article = await this.databaseService.findGlobalById(refId)

    if (!article) {
      throw createAppException(AppErrorCode.CONTENT_NOT_FOUND, { id: refId })
    }
    const summaries = this.toSummaryDocs(
      await this.aiSummaryRepository.listForRef(refId),
    )

    return {
      summaries,
      article,
    }
  }

  async getAllSummaries(pager: BasicPagerInput) {
    const { page, size } = pager
    const summaries = await this.aiSummaryRepository.list(page, size)
    const docs = this.toSummaryDocs(summaries.data)
    const data = {
      data: docs,
      pagination: summaries.pagination,
    }

    return {
      ...data,
      articles: await this.getRefArticles(docs),
    }
  }

  async getAllSummariesGrouped(query: GetSummariesGroupedQueryInput) {
    const { page, size } = query
    const search = query.search?.trim()
    const searchableRefIds = search
      ? await this.databaseService.findPostAndNoteIdsByTitle(search)
      : undefined

    if (search && searchableRefIds?.length === 0) {
      return {
        data: [],
        pagination: paginationOf(0, page, size),
      }
    }

    const grouped = await this.aiSummaryRepository.groupedByRef(
      page,
      size,
      searchableRefIds,
    )
    const groupedRefIds = grouped.data
    const total = grouped.pagination.total

    if (groupedRefIds.length === 0) {
      return {
        data: [],
        pagination: paginationOf(0, page, size),
      }
    }

    // Get all summaries for these refIds
    const refIds = groupedRefIds.map((g) => g.refId)
    const summaries = this.toSummaryDocs(
      await this.aiSummaryRepository.listByRefIds(refIds),
    )

    // Get article info
    const articleMap = await this.databaseService.getRefArticleMap(refIds)

    // Group summaries by refId
    const summariesByRefId = summaries.reduce(
      (acc, summary) => {
        if (!acc[summary.refId]) {
          acc[summary.refId] = []
        }
        acc[summary.refId].push(summary)
        return acc
      },
      {} as Record<string, AISummaryModel[]>,
    )

    // Build grouped data maintaining the order from aggregation
    const groupedData = refIds
      .map((refId: string) => {
        const article = articleMap[refId]
        if (!article) return null
        return {
          article,
          summaries: summariesByRefId[refId] || [],
        }
      })
      .filter(Boolean)

    return {
      data: groupedData,
      pagination: paginationOf(total, page, size),
    }
  }

  private async getRefArticles(docs: AISummaryModel[]) {
    return this.databaseService.getRefArticleMap(docs.map((d) => d.refId))
  }

  async updateSummaryInDb(id: string, summary: string) {
    const doc = this.toSummaryDoc(await this.aiSummaryRepository.findById(id))
    if (!doc) {
      throw createAppException(AppErrorCode.CONTENT_NOT_FOUND_CANT_PROCESS)
    }

    return this.toSummaryDoc(
      await this.aiSummaryRepository.updateSummary(id, summary),
    )
  }
  async getSummaryByArticleId(articleId: string, lang = DEFAULT_SUMMARY_LANG) {
    const { document } = await this.resolveArticleForSummary(articleId)
    return this.findValidSummary(articleId, lang, document.text)
  }

  async getSummaryForPublicMeta(
    articleId: string,
    lang: string,
  ): Promise<AISummaryModel | null> {
    try {
      return this.toSummaryDoc(
        await this.aiSummaryRepository.findByRefAndLang(articleId, lang),
      )
    } catch (error) {
      this.logger.warn(
        `summary meta lookup failed: article=${articleId} lang=${lang} ${
          (error as Error).message
        }`,
      )
      return null
    }
  }

  async getSummaryById(id: string) {
    const doc = this.toSummaryDoc(await this.aiSummaryRepository.findById(id))
    if (!doc) {
      throw createAppException(AppErrorCode.CONTENT_NOT_FOUND_CANT_PROCESS)
    }
    return doc
  }

  async streamSummaryForArticle(
    articleId: string,
    options: { lang: string },
  ): Promise<{
    events: AsyncIterable<AiStreamEvent>
    result: Promise<AISummaryModel>
  }> {
    const aiConfig = await this.configService.get('ai')

    if (!aiConfig?.enableSummary) {
      throw createAppException(AppErrorCode.AI_NOT_ENABLED)
    }

    const { lang } = options
    const { document } = await this.resolveArticleForSummary(articleId)

    const existingSummary = await this.findValidSummary(
      articleId,
      lang,
      document.text,
    )

    if (existingSummary) {
      this.logger.debug(`Summary cache hit: article=${articleId} lang=${lang}`)
      return this.wrapAsImmediateStream(existingSummary)
    }

    return this.runSummaryGeneration(articleId, lang, document)
  }

  async getOrGenerateSummaryForArticle(
    articleId: string,
    options: {
      lang: string
      onlyDb?: boolean
    },
  ) {
    const { onlyDb, lang } = options

    const dbStored = await this.getSummaryByArticleId(articleId, lang)

    if (dbStored) {
      return dbStored
    }

    if (onlyDb) {
      return null
    }

    const aiConfig = await this.configService.get('ai')

    if (!aiConfig?.enableSummary) {
      throw createAppException(AppErrorCode.AI_NOT_ENABLED)
    }

    return this.generateSummaryByOpenAI(articleId, lang)
  }

  async deleteSummaryByArticleId(articleId: string) {
    await this.aiSummaryRepository.deleteForRef(articleId)
  }

  async deleteSummaryInDb(id: string) {
    await this.aiSummaryRepository.deleteById(id)
  }

  @OnEvent(BusinessEvents.POST_DELETE)
  @OnEvent(BusinessEvents.NOTE_DELETE)
  @OnEvent(BusinessEvents.PAGE_DELETE)
  async handleDeleteArticle(event: { id: string }) {
    await this.deleteSummaryByArticleId(event.id)
  }

  @OnEvent(BusinessEvents.POST_CREATE)
  @OnEvent(BusinessEvents.NOTE_CREATE)
  async handleCreateArticle(event: { id: string }) {
    const aiConfig = await this.configService.get('ai')
    if (
      !aiConfig.enableSummary ||
      !aiConfig.enableAutoGenerateSummaryOnCreate
    ) {
      return
    }
    const targetLanguages = resolveTargetLanguages(
      undefined,
      aiConfig.summaryTargetLanguages,
    )
    if (!targetLanguages.length) {
      return
    }

    const minLen = aiConfig.summaryMinTextLength ?? 0
    if (minLen > 0) {
      try {
        const { document } = await this.resolveArticleForSummary(event.id)
        if ((document.text?.length ?? 0) < minLen) {
          this.logger.debug(
            `AI auto summary skipped (text below threshold ${minLen}): article=${event.id}`,
          )
          return
        }
      } catch {
        return
      }
    }

    this.logger.log(`AI auto summary task created: article=${event.id}`)
    await this.aiTaskService.createSummaryTask({
      refId: event.id,
      targetLanguages,
    })
  }

  @OnEvent(BusinessEvents.POST_UPDATE)
  @OnEvent(BusinessEvents.NOTE_UPDATE)
  async handleUpdateArticle(event: { id: string }) {
    const aiConfig = await this.configService.get('ai')
    if (
      !aiConfig.enableSummary ||
      !aiConfig.enableAutoGenerateSummaryOnUpdate
    ) {
      return
    }

    const id = event.id
    let document: { text: string; title: string }
    try {
      const resolved = await this.resolveArticleForSummary(id)
      document = resolved.document
    } catch {
      return
    }

    const minLen = aiConfig.summaryMinTextLength ?? 0
    if (minLen > 0 && (document.text?.length ?? 0) < minLen) {
      this.logger.debug(
        `AI auto summary skipped (text below threshold ${minLen}): article=${id}`,
      )
      return
    }

    const existingSummaries = this.toSummaryDocs(
      await this.aiSummaryRepository.listForRef(id),
    )
    if (!existingSummaries.length) {
      return
    }

    const newHash = this.computeContentHash(document.text)
    const outdatedLanguages = existingSummaries
      .filter((s) => s.hash !== newHash)
      .map((s) => s.lang)
      .filter(Boolean) as string[]

    if (!outdatedLanguages.length) {
      return
    }

    this.logger.log(`AI auto summary task created (update): article=${id}`)
    await this.aiTaskService.createSummaryTask({
      refId: id,
      targetLanguages: outdatedLanguages,
    })
  }
}
