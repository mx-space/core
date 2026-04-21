import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter'
import removeMdCodeblock from 'remove-md-codeblock'

import { BizException } from '~/common/exceptions/biz.exception'
import { BusinessEvents } from '~/constants/business-event.constant'
import { CollectionRefTypes } from '~/constants/db.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { DatabaseService } from '~/processors/database/database.service'
import {
  type TaskExecuteContext,
  TaskQueueProcessor,
} from '~/processors/task-queue'
import type { PagerDto } from '~/shared/dto/pager.dto'
import { InjectModel } from '~/transformers/model.transformer'
import { transformDataToPaginate } from '~/transformers/paginate.transformer'
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
import { AiTaskService } from '../ai-task/ai-task.service'
import { AITaskType, type InsightsTaskPayload } from '../ai-task/ai-task.types'
import { AIInsightsModel } from './ai-insights.model'
import type { GetInsightsGroupedQueryInput } from './ai-insights.schema'
import { stripTopLevelCodeFence } from './insights.util'

interface ArticleForInsights {
  title: string
  text: string
  subtitle?: string
  tags?: string[]
  lang?: string
}

@Injectable()
export class AiInsightsService implements OnModuleInit {
  private readonly logger = new Logger(AiInsightsService.name)

  constructor(
    @InjectModel(AIInsightsModel)
    private readonly aiInsightsModel: MongooseModel<AIInsightsModel>,
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigsService,
    private readonly aiService: AiService,
    private readonly aiInFlightService: AiInFlightService,
    private readonly taskProcessor: TaskQueueProcessor,
    private readonly aiTaskService: AiTaskService,
    private readonly eventEmitter: EventEmitter2,
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
        await context.updateProgress(0, 'Generating insights', 0, 1)
        const result = await this.generateInsights(payload.refId)
        await context.setResult({ insightsId: result.id, lang: result.lang })
        await context.updateProgress(100, 'Done', 1, 1)
      },
    })
    this.logger.log('AI insights task handler registered')
  }

  private checkAborted(context: TaskExecuteContext) {
    if (context.isAborted()) throw createAbortError()
  }

  private serializeText(text: string) {
    return removeMdCodeblock(text)
  }

  private computeContentHash(text: string): string {
    return md5(this.serializeText(text))
  }

  private buildInsightsKey(articleId: string, lang: string, text: string) {
    return md5(
      JSON.stringify({
        feature: 'insights',
        articleId,
        lang,
        textHash: md5(text),
      }),
    )
  }

  private async resolveArticleForInsights(articleId: string): Promise<{
    article: ArticleForInsights
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
    const doc = article.document as any
    return {
      article: {
        title: doc.title,
        text: doc.text,
        subtitle: doc.subtitle,
        tags: Array.isArray(doc.tags) ? doc.tags : undefined,
        lang: doc.lang,
      },
      type: article.type,
    }
  }

  private async findValidInsights(
    articleId: string,
    lang: string,
    text: string,
  ): Promise<AIInsightsModel | null> {
    const contentHash = this.computeContentHash(text)
    return this.aiInsightsModel.findOne({
      refId: articleId,
      lang,
      hash: contentHash,
    })
  }

  private resolveSourceLang(article: ArticleForInsights): string {
    return article.lang || DEFAULT_SUMMARY_LANG
  }

  private async generateInsightsViaAIStream(
    article: ArticleForInsights,
    lang: string,
    push?: (event: AiStreamEvent) => Promise<void>,
    onToken?: (count?: number) => Promise<void>,
  ): Promise<{
    content: string
    modelInfo?: { provider: string; model: string }
  }> {
    const runtime = await this.aiService.getInsightsModel()
    const { systemPrompt, prompt, reasoningEffort } = AI_PROMPTS.insightsStream(
      lang,
      article,
    )
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: prompt },
    ]

    let fullText = ''
    if (runtime.generateTextStream) {
      for await (const chunk of runtime.generateTextStream({
        messages,
        temperature: 0.6,
        maxRetries: 2,
        reasoningEffort,
      })) {
        fullText += chunk.text
        if (push) await push({ type: 'token', data: chunk.text })
        if (onToken) await onToken()
      }
    } else {
      const result = await runtime.generateText({
        messages,
        temperature: 0.6,
        maxRetries: 2,
        reasoningEffort,
      })
      fullText = result.text
      if (push && result.text) await push({ type: 'token', data: result.text })
      if (onToken && result.text) await onToken()
    }
    // Strip an accidental top-level code fence if the model wrapped the whole answer.
    const stripped = stripTopLevelCodeFence(fullText)
    return { content: stripped.trim() }
  }

  private async runInsightsGeneration(
    articleId: string,
    lang: string,
    article: ArticleForInsights,
    onToken?: (count?: number) => Promise<void>,
  ) {
    const text = this.serializeText(article.text)
    const key = this.buildInsightsKey(articleId, lang, text)

    return this.aiInFlightService.runWithStream<AIInsightsModel>({
      key,
      lockTtlSec: AI_STREAM_LOCK_TTL,
      resultTtlSec: AI_STREAM_RESULT_TTL,
      streamMaxLen: AI_STREAM_MAXLEN,
      readBlockMs: AI_STREAM_READ_BLOCK_MS,
      idleTimeoutMs: AI_STREAM_IDLE_TIMEOUT_MS,
      onLeader: async ({ push }) => {
        const { content } = await this.generateInsightsViaAIStream(
          article,
          lang,
          push,
          onToken,
        )
        const contentMd5 = md5(text)
        const sourceLang = lang
        // Invalidate stale translations before writing the new source row.
        await this.aiInsightsModel.deleteMany({
          refId: articleId,
          isTranslation: true,
          hash: { $ne: contentMd5 },
        })
        // Upsert source row to satisfy the unique (refId, lang) index when
        // a previous source row exists (e.g. on article text update).
        const doc = await this.aiInsightsModel.findOneAndUpdate(
          { refId: articleId, lang },
          {
            hash: contentMd5,
            lang,
            refId: articleId,
            content,
            isTranslation: false,
            sourceLang,
            $unset: { sourceInsightsId: '' },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        )
        this.eventEmitter.emit(BusinessEvents.INSIGHTS_GENERATED, {
          refId: articleId,
          sourceLang,
          insightsId: doc.id,
          sourceHash: contentMd5,
        })
        return { result: doc, resultId: doc.id }
      },
      parseResult: async (resultId) => {
        const doc = await this.aiInsightsModel.findById(resultId)
        if (!doc) {
          throw new BizException(ErrorCodeEnum.ContentNotFoundCantProcess)
        }
        return doc
      },
    })
  }

  async generateInsights(
    articleId: string,
    onToken?: (count?: number) => Promise<void>,
  ): Promise<AIInsightsModel> {
    const {
      ai: { enableInsights },
    } = await this.configService.waitForConfigReady()
    if (!enableInsights) {
      throw new BizException(ErrorCodeEnum.AINotEnabled)
    }
    const { article } = await this.resolveArticleForInsights(articleId)
    const lang = this.resolveSourceLang(article)
    try {
      const { result } = await this.runInsightsGeneration(
        articleId,
        lang,
        article,
        onToken,
      )
      return await result
    } catch (error) {
      if (error instanceof BizException) throw error
      this.logger.error(
        `AI insights generation failed for article ${articleId}: ${(error as Error).message}`,
        (error as Error).stack,
      )
      throw new BizException(
        ErrorCodeEnum.AIException,
        (error as Error).message,
      )
    }
  }

  private wrapAsImmediateStream(doc: AIInsightsModel): {
    events: AsyncIterable<AiStreamEvent>
    result: Promise<AIInsightsModel>
  } {
    const events = (async function* () {
      yield { type: 'done' as const, data: { resultId: doc.id } }
    })()
    return { events, result: Promise.resolve(doc) }
  }

  async streamInsightsForArticle(
    articleId: string,
    options: { lang: string },
  ): Promise<{
    events: AsyncIterable<AiStreamEvent>
    result: Promise<AIInsightsModel>
  }> {
    const aiConfig = await this.configService.get('ai')
    if (!aiConfig?.enableInsights) {
      throw new BizException(ErrorCodeEnum.AINotEnabled)
    }
    const { article } = await this.resolveArticleForInsights(articleId)
    const lang = options.lang || this.resolveSourceLang(article)
    const existing = await this.findValidInsights(articleId, lang, article.text)
    if (existing) {
      this.logger.debug(`Insights cache hit: article=${articleId} lang=${lang}`)
      return this.wrapAsImmediateStream(existing)
    }
    return this.runInsightsGeneration(articleId, lang, article)
  }

  async getOrGenerateInsightsForArticle(
    articleId: string,
    options: { lang: string; onlyDb?: boolean },
  ): Promise<AIInsightsModel | null> {
    const { article } = await this.resolveArticleForInsights(articleId)
    const lang = options.lang || this.resolveSourceLang(article)
    const existing = await this.findValidInsights(articleId, lang, article.text)
    if (existing) return existing
    if (options.onlyDb) return null
    const aiConfig = await this.configService.get('ai')
    if (!aiConfig?.enableInsights) {
      throw new BizException(ErrorCodeEnum.AINotEnabled)
    }
    return this.generateInsights(articleId)
  }

  async findSourceInsightsForArticle(
    refId: string,
  ): Promise<AIInsightsModel | null> {
    return this.aiInsightsModel
      .findOne({ refId, isTranslation: false })
      .sort({ created: -1 })
  }

  /**
   * Lightweight existence check used by article responses to tell the
   * frontend whether insights are already available in the requested lang —
   * either as a source row or as a translation. Hash is not verified; this
   * only answers "do we have any insights document for (refId, lang)?".
   */
  async hasInsightsInLang(refId: string, lang: string): Promise<boolean> {
    const exists = await this.aiInsightsModel.exists({ refId, lang })
    return !!exists
  }

  async getInsightsById(id: string) {
    const doc = await this.aiInsightsModel.findById(id)
    if (!doc) throw new BizException(ErrorCodeEnum.ContentNotFoundCantProcess)
    return doc
  }

  async getInsightsByRefId(refId: string) {
    const article = await this.databaseService.findGlobalById(refId)
    if (!article) throw new BizException(ErrorCodeEnum.ContentNotFound)
    const insights = await this.aiInsightsModel.find({ refId })
    return { insights, article }
  }

  async getAllInsights(pager: PagerDto) {
    const { page, size } = pager
    const result = await this.aiInsightsModel.paginate(
      {},
      {
        page,
        limit: size,
        sort: { created: -1 },
        lean: true,
        leanWithId: true,
      },
    )
    const data = transformDataToPaginate(result)
    return { ...data, articles: await this.getRefArticles(result.docs) }
  }

  async getAllInsightsGrouped(query: GetInsightsGroupedQueryInput) {
    const { page, size, search } = query

    let matchedRefIds: string[] | null = null
    if (search?.trim()) {
      const keyword = search.trim()
      const postModel = this.databaseService.getModelByRefType(
        CollectionRefTypes.Post,
      )
      const noteModel = this.databaseService.getModelByRefType(
        CollectionRefTypes.Note,
      )
      const [matchedPosts, matchedNotes] = await Promise.all([
        postModel
          .find({ title: { $regex: keyword, $options: 'i' } })
          .select('_id')
          .lean(),
        noteModel
          .find({ title: { $regex: keyword, $options: 'i' } })
          .select('_id')
          .lean(),
      ])
      matchedRefIds = [
        ...matchedPosts.map((p) => p._id.toString()),
        ...matchedNotes.map((n) => n._id.toString()),
      ]
      if (!matchedRefIds.length) {
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

    const pipeline: any[] = []
    if (matchedRefIds)
      pipeline.push({ $match: { refId: { $in: matchedRefIds } } })
    pipeline.push(
      {
        $group: {
          _id: '$refId',
          latestCreated: { $max: '$created' },
          insightsCount: { $sum: 1 },
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

    const aggResult = await this.aiInsightsModel.aggregate(pipeline)
    const metadata = aggResult[0]?.metadata[0]
    const groupedRefIds = aggResult[0]?.data || []
    const total = metadata?.total || 0
    if (!groupedRefIds.length) {
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
    const insights = await this.aiInsightsModel
      .find({ refId: { $in: refIds } })
      .sort({ created: -1 })
      .lean()
    const articles = await this.databaseService.findGlobalByIds(refIds)
    const articleMap: Record<
      string,
      { title: string; id: string; type: CollectionRefTypes }
    > = {}
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
    const insightsByRef = insights.reduce(
      (acc, ins) => {
        ;(acc[ins.refId] ||= []).push(ins)
        return acc
      },
      {} as Record<string, AIInsightsModel[]>,
    )
    const groupedData = refIds
      .map((refId: string) => {
        const article = articleMap[refId]
        if (!article) return null
        return { article, insights: insightsByRef[refId] || [] }
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

  private async getRefArticles(docs: AIInsightsModel[]) {
    const articles = await this.databaseService.findGlobalByIds(
      docs.map((d) => d.refId),
    )
    const articleMap: Record<
      string,
      { title: string; id: string; type: CollectionRefTypes }
    > = {}
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
    return articleMap
  }

  async updateInsightsInDb(id: string, content: string) {
    const doc = await this.aiInsightsModel.findById(id)
    if (!doc) throw new BizException(ErrorCodeEnum.ContentNotFoundCantProcess)
    doc.content = content
    await doc.save()
    return doc
  }

  async deleteInsightsInDb(id: string) {
    await this.aiInsightsModel.deleteOne({ _id: id })
  }

  async deleteInsightsByArticleId(refId: string) {
    await this.aiInsightsModel.deleteMany({ refId })
  }

  @OnEvent(BusinessEvents.POST_DELETE)
  @OnEvent(BusinessEvents.NOTE_DELETE)
  async handleDeleteArticle(event: { id: string }) {
    await this.deleteInsightsByArticleId(event.id)
  }

  @OnEvent(BusinessEvents.POST_CREATE)
  @OnEvent(BusinessEvents.NOTE_CREATE)
  async handleCreateArticle(event: { id: string }) {
    const aiConfig = await this.configService.get('ai')
    if (
      !aiConfig.enableInsights ||
      !aiConfig.enableAutoGenerateInsightsOnCreate
    ) {
      return
    }
    this.logger.log(`AI auto insights task created: article=${event.id}`)
    await this.aiTaskService.createInsightsTask({ refId: event.id })
  }

  @OnEvent(BusinessEvents.POST_UPDATE)
  @OnEvent(BusinessEvents.NOTE_UPDATE)
  async handleUpdateArticle(event: { id: string }) {
    const aiConfig = await this.configService.get('ai')
    if (
      !aiConfig.enableInsights ||
      !aiConfig.enableAutoGenerateInsightsOnUpdate
    ) {
      return
    }
    let article: ArticleForInsights
    try {
      const resolved = await this.resolveArticleForInsights(event.id)
      article = resolved.article
    } catch {
      return
    }
    const newHash = this.computeContentHash(article.text)
    const existing = await this.aiInsightsModel.find({
      refId: event.id,
      isTranslation: false,
    })
    if (!existing.length) return
    const stale = existing.some((doc) => doc.hash !== newHash)
    if (!stale) return
    this.logger.log(
      `AI auto insights task created (update): article=${event.id}`,
    )
    await this.aiTaskService.createInsightsTask({ refId: event.id })
  }
}
