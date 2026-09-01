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
import { AiGenerationMetricsService } from '../ai-generation-metrics/ai-generation-metrics.service'
import type { AiStreamEvent } from '../ai-inflight/ai-inflight.types'
import { MultilangGenerationService } from '../ai-multilang/ai-multilang.service'
import { AITaskType, type InsightsTaskPayload } from '../ai-task/ai-task.types'
import { buildGroupedWithOrphans } from '../grouped-with-orphans.util'
import { AiInsightsAdapter } from './ai-insights.adapter'
import { AiInsightsRepository } from './ai-insights.repository'
import type { GetInsightsGroupedQueryInput } from './ai-insights.schema'
import type { type AIInsightsModel, AiInsightsRow } from './ai-insights.types'

@Injectable()
export class AiInsightsService implements OnModuleInit {
  private readonly logger = new Logger(AiInsightsService.name)

  constructor(
    private readonly aiInsightsRepository: AiInsightsRepository,
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigsService,
    private readonly adapter: AiInsightsAdapter,
    private readonly multilang: MultilangGenerationService,
    private readonly taskProcessor: TaskQueueProcessor,
    private readonly generationMetrics: AiGenerationMetricsService,
  ) {}

  onModuleInit() {
    this.registerTaskHandler()
  }

  private registerTaskHandler() {
    this.taskProcessor.registerHandler({
      type: AITaskType.Insights,
      execute: async (
        payload: InsightsTaskPayload,
        context: TaskExecuteContext,
      ) => {
        this.checkAborted(context)
        const { base, sourceLang, translated, failedLangs } =
          await this.multilang.executeMultilangTask(
            this.adapter,
            payload,
            context,
          )
        await context.setResult({
          insightsId: base.id,
          lang: sourceLang,
          translated: translated.map((t) => t.lang),
          failedLangs,
        })
      },
    })
    this.logger.log('AI insights task handler registered')
  }

  private checkAborted(context: TaskExecuteContext) {
    if (context.isAborted()) throw createAbortError()
  }

  private toInsightsDoc(row: AiInsightsRow | null): AIInsightsModel | null {
    return this.adapter.toInsightsDoc(row)
  }

  private toInsightsDocs(rows: AiInsightsRow[]): AIInsightsModel[] {
    return rows.map((row) => this.toInsightsDoc(row)!)
  }

  private async findValidInsights(
    articleId: string,
    lang: string,
    text: string,
  ): Promise<AIInsightsModel | null> {
    const contentHash = this.multilang.computeContentHash(text)
    const row = await this.aiInsightsRepository.findByRefAndLang(
      articleId,
      lang,
    )
    return row?.hash === contentHash ? this.toInsightsDoc(row) : null
  }

  async generateInsights(
    articleId: string,
    onToken?: (count?: number) => Promise<void>,
    onCost?: (usd: number) => Promise<void>,
    taskId?: string,
    force?: boolean,
  ): Promise<AIInsightsModel> {
    await this.adapter.assertEnabled()
    const { article, sourceLang } =
      await this.adapter.resolveArticleDetailed(articleId)
    try {
      const { result } = await this.multilang.runBaseGeneration(this.adapter, {
        refId: articleId,
        lang: sourceLang,
        article,
        text: article.text,
        onToken,
        onCost,
        taskId,
        force,
      })
      return await result
    } catch (error) {
      if (error instanceof AppException) throw error
      this.logger.error(
        `AI insights generation failed for article ${articleId}: ${(error as Error).message}`,
        (error as Error).stack,
      )
      throw createAppException(AppErrorCode.AI_SERVICE_ERROR, {
        message: (error as Error).message,
      })
    }
  }

  private wrapAsImmediateStream(doc: AIInsightsModel): {
    events: AsyncIterable<AiStreamEvent>
    result: Promise<AIInsightsModel>
  } {
    const events = (async function* () {
      yield { type: 'done' as const, data: { resultId: doc.id! } }
    })()
    return { events, result: Promise.resolve(doc) }
  }

  async streamInsightsForArticle(
    articleId: string,
    options: { lang: string; isOwner?: boolean; readerId?: string },
  ): Promise<{
    events: AsyncIterable<AiStreamEvent>
    result: Promise<AIInsightsModel>
  }> {
    const aiConfig = await this.configService.get('ai')
    if (!aiConfig?.enableInsights) {
      throw createAppException(AppErrorCode.AI_NOT_ENABLED)
    }
    const { article, sourceLang } = await this.adapter.resolveArticleDetailed(
      articleId,
      {
        blockPremium: true,
        isOwner: options.isOwner,
        readerId: options.readerId,
      },
    )
    const lang = options.lang || sourceLang
    const existing = await this.findValidInsights(articleId, lang, article.text)
    if (existing) {
      this.logger.debug(`Insights cache hit: article=${articleId} lang=${lang}`)
      return this.wrapAsImmediateStream(existing)
    }
    return this.multilang.runBaseGeneration(this.adapter, {
      refId: articleId,
      lang,
      article,
      text: article.text,
    })
  }

  async getOrGenerateInsightsForArticle(
    articleId: string,
    options: {
      lang: string
      onlyDb?: boolean
      isOwner?: boolean
      readerId?: string
    },
  ): Promise<AIInsightsModel | null> {
    const { article, sourceLang } = await this.adapter.resolveArticleDetailed(
      articleId,
      {
        blockPremium: true,
        isOwner: options.isOwner,
        readerId: options.readerId,
      },
    )
    const lang = options.lang || sourceLang
    const existing = await this.findValidInsights(articleId, lang, article.text)
    if (existing) return existing
    if (options.onlyDb) return null
    const aiConfig = await this.configService.get('ai')
    if (!aiConfig?.enableInsights) {
      throw createAppException(AppErrorCode.AI_NOT_ENABLED)
    }
    return this.generateInsights(articleId)
  }

  async findSourceInsightsForArticle(
    refId: string,
  ): Promise<AIInsightsModel | null> {
    const { sourceLang } = await this.adapter.resolveArticleDetailed(refId)
    return this.adapter.findBase(refId, sourceLang)
  }

  /**
   * Lightweight existence check used by article responses to tell the
   * frontend whether insights are already available in the requested lang —
   * either as a source row or as a translation. Hash is not verified; this
   * only answers "do we have any insights document for (refId, lang)?".
   */
  async hasInsightsInLang(refId: string, lang: string): Promise<boolean> {
    return !!(await this.aiInsightsRepository.findByRefAndLang(refId, lang))
  }

  async getInsightsById(id: string) {
    const doc = this.toInsightsDoc(await this.aiInsightsRepository.findById(id))
    if (!doc)
      throw createAppException(AppErrorCode.CONTENT_NOT_FOUND_CANT_PROCESS)
    return doc
  }

  async getInsightsByRefId(refId: string) {
    const article = await this.databaseService.findGlobalById(refId)
    if (!article)
      throw createAppException(AppErrorCode.CONTENT_NOT_FOUND, { id: refId })
    const insights = await this.generationMetrics.attachLatest(
      'insights',
      this.toInsightsDocs(await this.aiInsightsRepository.listForRef(refId)),
    )
    return { insights, article }
  }

  async getAllInsights(pager: BasicPagerInput) {
    const { page, size } = pager
    const result = await this.aiInsightsRepository.list(page, size)
    const docs = await this.generationMetrics.attachLatest(
      'insights',
      this.toInsightsDocs(result.data),
    )
    return {
      data: docs,
      pagination: result.pagination,
      articles: await this.getRefArticles(docs),
    }
  }

  async getAllInsightsGrouped(query: GetInsightsGroupedQueryInput) {
    const { data, pagination } = await buildGroupedWithOrphans<AIInsightsModel>(
      {
        page: query.page,
        size: query.size,
        search: query.search,
        databaseService: this.databaseService,
        fetchCandidateArticles: () =>
          this.databaseService.findAllArticlesForAIText(),
        fetchRecordsPage: (page, size, refIds) =>
          this.aiInsightsRepository.groupedByRef(page, size, refIds),
        fetchRecordsDistinctRefIds: (refIds) =>
          this.aiInsightsRepository.findDistinctRefIds(refIds),
        fetchItemsByRefIds: async (refIds) =>
          this.generationMetrics.attachLatest(
            'insights',
            this.toInsightsDocs(
              await this.aiInsightsRepository.listByRefIds(refIds),
            ),
          ),
        getItemRefId: (item) => item.refId,
      },
    )
    return {
      data: data.map((row) => ({
        article: row.article,
        insights: row.items,
      })),
      pagination,
    }
  }

  private async getRefArticles(docs: AIInsightsModel[]) {
    return this.databaseService.getRefArticleMap(docs.map((d) => d.refId))
  }

  async updateInsightsInDb(id: string, content: string) {
    const doc = this.toInsightsDoc(await this.aiInsightsRepository.findById(id))
    if (!doc)
      throw createAppException(AppErrorCode.CONTENT_NOT_FOUND_CANT_PROCESS)
    return this.toInsightsDoc(
      await this.aiInsightsRepository.updateContent(id, content),
    )
  }

  async deleteInsightsInDb(id: string) {
    await this.aiInsightsRepository.deleteById(id)
    await this.generationMetrics.deleteByResource('insights', id)
  }

  async deleteInsightsByArticleId(refId: string) {
    const rows = await this.aiInsightsRepository.listForRef(refId)
    await this.aiInsightsRepository.deleteForRef(refId)
    for (const row of rows) {
      await this.generationMetrics.deleteByResource('insights', String(row.id))
    }
  }

  @OnEvent(BusinessEvents.POST_DELETE)
  @OnEvent(BusinessEvents.NOTE_DELETE)
  @OnEvent(BusinessEvents.PAGE_DELETE)
  async handleDeleteArticle(event: { id: string }) {
    await this.deleteInsightsByArticleId(event.id)
  }
}
