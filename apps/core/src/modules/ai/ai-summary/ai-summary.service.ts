import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import removeMdCodeblock from 'remove-md-codeblock'

import { BizException } from '~/common/exceptions/biz.exception'
import { BusinessEvents } from '~/constants/business-event.constant'
import { CollectionRefTypes } from '~/constants/db.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { DatabaseService } from '~/processors/database/database.service'
import {
  type TaskExecuteContext,
  TaskQueueProcessor,
  TaskStatus,
} from '~/processors/task-queue'
import type { PagerDto } from '~/shared/dto/pager.dto'
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
import { AiSummaryRepository, type AiSummaryRow } from './ai-summary.repository'
import type { GetSummariesGroupedQueryInput } from './ai-summary.schema'
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
   * 计算内容 hash，用于检测内容是否变更
   */
  private computeContentHash(text: string): string {
    return md5(this.serializeText(text))
  }

  private toSummaryDoc(row: AiSummaryRow | null): AISummaryModel | null {
    if (!row) return null
    return {
      ...row,
      _id: row.id,
      created: row.createdAt,
    } as unknown as AISummaryModel
  }

  private toSummaryDocs(rows: AiSummaryRow[]): AISummaryModel[] {
    return rows.map((row) => this.toSummaryDoc(row)!)
  }

  /**
   * 获取并验证文章，用于摘要相关操作
   */
  private async resolveArticleForSummary(articleId: string): Promise<{
    document: { text: string; title: string }
    type: CollectionRefTypes.Post | CollectionRefTypes.Note
  }> {
    const article = await this.databaseService.findGlobalById(articleId)
    if (!article || !article.document) {
      throw new BizException(ErrorCodeEnum.ContentNotFoundCantProcess)
    }

    if (
      article.type === CollectionRefTypes.Recently ||
      article.type === CollectionRefTypes.Page
    ) {
      throw new BizException(ErrorCodeEnum.ContentNotFoundCantProcess)
    }

    return {
      document: article.document,
      type: article.type,
    }
  }

  /**
   * 检查数据库中是否存在 hash 匹配的有效摘要
   */
  private async findValidSummary(
    articleId: string,
    lang: string,
    text: string,
  ): Promise<AISummaryModel | null> {
    const contentHash = this.computeContentHash(text)

    return this.toSummaryDoc(
      await this.aiSummaryRepository.findByHash(articleId, contentHash),
    )
  }

  /**
   * 将已有摘要包装为立即返回的 stream 格式
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
    if (runtime.generateTextStream) {
      for await (const chunk of runtime.generateTextStream({
        messages,
        temperature: 0.5,
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
        temperature: 0.5,
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

    const parsed = JSON.parse(fullText) as { summary?: string }
    if (!parsed?.summary || typeof parsed.summary !== 'string') {
      throw new Error('Invalid summary JSON response')
    }

    return { summary: parsed.summary, rawText: fullText }
  }

  private async runSummaryGeneration(
    articleId: string,
    lang: string,
    document: { text: string },
    onToken?: (count?: number) => Promise<void>,
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
          throw new BizException(ErrorCodeEnum.ContentNotFoundCantProcess)
        }
        return doc
      },
    })
  }

  async generateSummaryByOpenAI(
    articleId: string,
    lang: string,
    onToken?: (count?: number) => Promise<void>,
  ) {
    const {
      ai: { enableSummary },
    } = await this.configService.waitForConfigReady()

    if (!enableSummary) {
      throw new BizException(ErrorCodeEnum.AINotEnabled)
    }

    const { document } = await this.resolveArticleForSummary(articleId)

    try {
      const { result } = await this.runSummaryGeneration(
        articleId,
        lang,
        document,
        onToken,
      )
      return await result
    } catch (error) {
      if (error instanceof BizException) {
        throw error
      }
      this.logger.error(
        `OpenAI 在处理文章 ${articleId} 时出错：${error.message}`,
        error.stack,
      )
      throw new BizException(ErrorCodeEnum.AIException, error.message)
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
      throw new BizException(ErrorCodeEnum.ContentNotFound)
    }
    const summaries = this.toSummaryDocs(
      await this.aiSummaryRepository.listForRef(refId),
    )

    return {
      summaries,
      article,
    }
  }

  async getAllSummaries(pager: PagerDto) {
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
    const { page, size, search: _search } = query

    // TODO: wave 3 — wire `_search` into the repository to filter grouped refs
    const grouped = await this.aiSummaryRepository.groupedByRef(page, size)
    const groupedRefIds = grouped.data
    const total = grouped.pagination.total

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

    // Get all summaries for these refIds
    const refIds = groupedRefIds.map((g) => g.refId)
    const summaries = this.toSummaryDocs(
      await this.aiSummaryRepository.listByRefIds(refIds),
    )

    // Get article info
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

  private async getRefArticles(docs: AISummaryModel[]) {
    const articles = await this.databaseService.findGlobalByIds(
      docs.map((d) => d.refId),
    )
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
    for (const a_1 of articles.posts) {
      articleMap[a_1.id] = {
        title: a_1.title,
        id: a_1.id,
        type: CollectionRefTypes.Post,
      }
    }
    return articleMap
  }

  async updateSummaryInDb(id: string, summary: string) {
    const doc = this.toSummaryDoc(await this.aiSummaryRepository.findById(id))
    if (!doc) {
      throw new BizException(ErrorCodeEnum.ContentNotFoundCantProcess)
    }

    return this.toSummaryDoc(
      await this.aiSummaryRepository.updateSummary(id, summary),
    )
  }
  async getSummaryByArticleId(articleId: string, lang = DEFAULT_SUMMARY_LANG) {
    const { document } = await this.resolveArticleForSummary(articleId)
    return this.findValidSummary(articleId, lang, document.text)
  }

  async getSummaryById(id: string) {
    const doc = this.toSummaryDoc(await this.aiSummaryRepository.findById(id))
    if (!doc) {
      throw new BizException(ErrorCodeEnum.ContentNotFoundCantProcess)
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
      throw new BizException(ErrorCodeEnum.AINotEnabled)
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
      throw new BizException(ErrorCodeEnum.AINotEnabled)
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
