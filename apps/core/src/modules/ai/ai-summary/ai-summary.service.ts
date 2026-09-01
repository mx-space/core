import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'

import { AppErrorCode, createAppException } from '~/common/errors'
import { AppException } from '~/common/errors/exception.types'
import { BusinessEvents } from '~/constants/business-event.constant'
import { DatabaseService } from '~/processors/database/database.service'
import {
  type TaskExecuteContext,
  TaskQueueProcessor,
} from '~/processors/task-queue'
import type { BasicPagerInput } from '~/shared/dto/pager.dto'
import { createAbortError } from '~/utils/abort.util'

import { ConfigsService } from '../../configs/configs.service'
import { DEFAULT_SUMMARY_LANG } from '../ai.constants'
import { AiGenerationMetricsService } from '../ai-generation-metrics/ai-generation-metrics.service'
import type { AiStreamEvent } from '../ai-inflight/ai-inflight.types'
import { resolveTargetLanguages } from '../ai-language.util'
import { MultilangGenerationService } from '../ai-multilang/ai-multilang.service'
import {
  AITaskType,
  type SummaryTaskPayload,
  type SummaryTranslationTaskPayload,
} from '../ai-task/ai-task.types'
import { buildGroupedWithOrphans } from '../grouped-with-orphans.util'
import { AiSummaryAdapter } from './ai-summary.adapter'
import { AiSummaryRepository } from './ai-summary.repository'
import type { GetSummariesGroupedQueryInput } from './ai-summary.schema'
import type { AISummaryModel, AiSummaryRow } from './ai-summary.types'

@Injectable()
export class AiSummaryService implements OnModuleInit {
  private readonly logger: Logger
  constructor(
    private readonly aiSummaryRepository: AiSummaryRepository,
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigsService,
    private readonly adapter: AiSummaryAdapter,
    private readonly multilang: MultilangGenerationService,
    private readonly taskProcessor: TaskQueueProcessor,
    private readonly generationMetrics: AiGenerationMetricsService,
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
        const targetLanguages = resolveTargetLanguages(
          payload.targetLanguages,
          aiConfig.summaryTargetLanguages,
        )
        const { base, translated, failedLangs } =
          await this.multilang.executeMultilangTask(
            this.adapter,
            { ...payload, targetLanguages },
            context,
          )
        const summaries = [base, ...translated.map((t) => t.doc)].map(
          (doc) => ({
            summaryId: doc.id!,
            lang: doc.lang!,
            summary: doc.summary,
          }),
        )
        await context.setResult({ summaries, failedLangs })
      },
    })

    this.taskProcessor.registerHandler({
      type: AITaskType.SummaryTranslation,
      execute: async (
        payload: SummaryTranslationTaskPayload,
        context: TaskExecuteContext,
      ) => {
        if (context.isAborted()) return
        await context.updateProgress(0, 'Translating summary', 0, 1)
        const result = await this.translateSummary(payload, context)
        await context.setResult({ summaryId: result.id, lang: result.lang })
        await context.updateProgress(100, 'Done', 1, 1)
      },
    })

    this.logger.log('AI summary task handler registered')
  }

  async translateSummary(
    payload: SummaryTranslationTaskPayload,
    context?: TaskExecuteContext,
  ): Promise<AISummaryModel> {
    const source = await this.adapter.findById(payload.sourceSummaryId)
    if (!source || source.isTranslation) {
      throw createAppException(AppErrorCode.CONTENT_NOT_FOUND_CANT_PROCESS, {
        message: 'Source summary not found or already translated',
      })
    }
    return this.multilang.runTranslation(this.adapter, {
      refId: payload.refId,
      base: source,
      targetLang: payload.targetLang,
      force: payload.force,
      taskId: context?.taskId,
      onCost: context?.incrementCost,
    })
  }

  private checkAborted(context: TaskExecuteContext) {
    if (context.isAborted()) {
      throw createAbortError()
    }
  }

  private toSummaryDoc(row: AiSummaryRow | null): AISummaryModel | null {
    return this.adapter.toSummaryDoc(row)
  }

  private toSummaryDocs(rows: AiSummaryRow[]): AISummaryModel[] {
    return rows.map((row) => this.toSummaryDoc(row)!)
  }

  private async findValidSummary(
    articleId: string,
    lang: string,
    text: string,
  ): Promise<AISummaryModel | null> {
    const contentHash = this.multilang.computeContentHash(text)

    return this.toSummaryDoc(
      await this.aiSummaryRepository.findByHash(articleId, contentHash, lang),
    )
  }

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

  async generateSummaryByOpenAI(
    articleId: string,
    lang: string,
    onToken?: (count?: number) => Promise<void>,
    onCost?: (usd: number) => Promise<void>,
    taskId?: string,
    force?: boolean,
  ) {
    await this.adapter.assertEnabled()

    const { article } = await this.adapter.resolveArticleDetailed(articleId)

    try {
      const { result } = await this.multilang.runBaseGeneration(this.adapter, {
        refId: articleId,
        lang,
        article,
        text: article.text,
        onToken,
        onCost,
        taskId,
        force,
      })
      return await result
    } catch (error) {
      if (error instanceof AppException) {
        throw error
      }
      this.logger.error(
        `AI summary failed while processing article ${articleId}: ${error.message}`,
        error.stack,
      )
      throw createAppException(AppErrorCode.AI_SERVICE_ERROR, {
        message: error.message,
      })
    }
  }

  async findBaseSummaryForArticle(
    refId: string,
  ): Promise<AISummaryModel | null> {
    const { sourceLang } = await this.adapter.resolveArticleDetailed(refId)
    return this.adapter.findBase(refId, sourceLang)
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
    const summaries = await this.generationMetrics.attachLatest(
      'summary',
      this.toSummaryDocs(await this.aiSummaryRepository.listForRef(refId)),
    )

    return {
      summaries,
      article,
    }
  }

  async getAllSummaries(pager: BasicPagerInput) {
    const { page, size } = pager
    const summaries = await this.aiSummaryRepository.list(page, size)
    const docs = await this.generationMetrics.attachLatest(
      'summary',
      this.toSummaryDocs(summaries.data),
    )
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
    const { data, pagination } = await buildGroupedWithOrphans<AISummaryModel>({
      page: query.page,
      size: query.size,
      search: query.search,
      databaseService: this.databaseService,
      fetchCandidateArticles: () =>
        this.databaseService.findAllArticlesForAIText(),
      fetchRecordsPage: (page, size, refIds) =>
        this.aiSummaryRepository.groupedByRef(page, size, refIds),
      fetchRecordsDistinctRefIds: (refIds) =>
        this.aiSummaryRepository.findDistinctRefIds(refIds),
      fetchItemsByRefIds: async (refIds) =>
        this.generationMetrics.attachLatest(
          'summary',
          this.toSummaryDocs(
            await this.aiSummaryRepository.listByRefIds(refIds),
          ),
        ),
      getItemRefId: (item) => item.refId,
    })
    return {
      data: data.map((row) => ({
        article: row.article,
        summaries: row.items,
      })),
      pagination,
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
    const { article } = await this.adapter.resolveArticleDetailed(articleId)
    return this.findValidSummary(articleId, lang, article.text)
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
    const { article } = await this.adapter.resolveArticleDetailed(articleId)

    const existingSummary = await this.findValidSummary(
      articleId,
      lang,
      article.text,
    )

    if (existingSummary) {
      this.logger.debug(`Summary cache hit: article=${articleId} lang=${lang}`)
      return this.wrapAsImmediateStream(existingSummary)
    }

    return this.multilang.runBaseGeneration(this.adapter, {
      refId: articleId,
      lang,
      article,
      text: article.text,
    })
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
    const rows = await this.aiSummaryRepository.listForRef(articleId)
    await this.aiSummaryRepository.deleteForRef(articleId)
    for (const row of rows) {
      await this.generationMetrics.deleteByResource('summary', String(row.id))
    }
  }

  async deleteSummaryInDb(id: string) {
    await this.aiSummaryRepository.deleteById(id)
    await this.generationMetrics.deleteByResource('summary', id)
  }

  @OnEvent(BusinessEvents.POST_DELETE)
  @OnEvent(BusinessEvents.NOTE_DELETE)
  @OnEvent(BusinessEvents.PAGE_DELETE)
  async handleDeleteArticle(event: { id: string }) {
    await this.deleteSummaryByArticleId(event.id)
  }
}
