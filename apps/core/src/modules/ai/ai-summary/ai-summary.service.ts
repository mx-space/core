import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { BizException } from '~/common/exceptions/biz.exception'
import { BusinessEvents } from '~/constants/business-event.constant'
import { CollectionRefTypes } from '~/constants/db.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { DatabaseService } from '~/processors/database/database.service'
import {
  TaskQueueProcessor,
  type TaskExecuteContext,
} from '~/processors/task-queue'
import type { PagerDto } from '~/shared/dto/pager.dto'
import { InjectModel } from '~/transformers/model.transformer'
import { transformDataToPaginate } from '~/transformers/paginate.transformer'
import { md5 } from '~/utils/tool.util'
import removeMdCodeblock from 'remove-md-codeblock'
import { ConfigsService } from '../../configs/configs.service'
import { AiInFlightService } from '../ai-inflight/ai-inflight.service'
import type { AiStreamEvent } from '../ai-inflight/ai-inflight.types'
import {
  resolveTargetLanguage,
  type ResolveLanguageOptions,
} from '../ai-language.util'
import { AITaskType, type SummaryTaskPayload } from '../ai-task/ai-task.types'
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
import { AISummaryModel } from './ai-summary.model'
import type { GetSummariesGroupedQueryInput } from './ai-summary.schema'

@Injectable()
export class AiSummaryService implements OnModuleInit {
  private readonly logger: Logger
  constructor(
    @InjectModel(AISummaryModel)
    private readonly aiSummaryModel: MongooseModel<AISummaryModel>,
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigsService,

    private readonly aiService: AiService,
    private readonly aiInFlightService: AiInFlightService,
    private readonly taskProcessor: TaskQueueProcessor,
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

        await context.appendLog(
          'info',
          `Generating summary for article ${payload.refId}`,
        )

        const lang = payload.lang || DEFAULT_SUMMARY_LANG
        const result = await this.generateSummaryByOpenAI(
          payload.refId,
          lang,
          context.incrementTokens,
        )

        this.checkAborted(context)

        await context.setResult({
          summaryId: result.id,
          summary: result.summary,
          lang: result.lang,
        })
      },
    })

    this.logger.log('AI summary task handler registered')
  }

  private checkAborted(context: TaskExecuteContext) {
    if (context.isAborted()) {
      const error = new Error('Task aborted')
      error.name = 'AbortError'
      throw error
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

    const doc = await this.aiSummaryModel.findOne({
      refId: articleId,
      lang,
      hash: contentHash,
    })

    return doc
  }

  /**
   * 将已有摘要包装为立即返回的 stream 格式
   */
  private wrapAsImmediateStream(summary: AISummaryModel): {
    events: AsyncIterable<AiStreamEvent>
    result: Promise<AISummaryModel>
  } {
    const events = (async function* () {
      yield { type: 'done' as const, data: { resultId: summary.id } }
    })()

    return {
      events,
      result: Promise.resolve(summary),
    }
  }

  /**
   * 计算摘要的目标语言
   */
  private async getTargetLanguage(
    options: ResolveLanguageOptions,
  ): Promise<string> {
    const aiConfig = await this.configService.get('ai')
    return resolveTargetLanguage(options, {
      configuredLanguage: aiConfig.aiSummaryTargetLanguage,
      defaultLanguage: DEFAULT_SUMMARY_LANG,
    })
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

        const doc = await this.aiSummaryModel.create({
          hash: contentMd5,
          lang,
          refId: articleId,
          summary,
        })

        return { result: doc, resultId: doc.id }
      },
      parseResult: async (resultId) => {
        const doc = await this.aiSummaryModel.findById(resultId)
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

  async getSummariesByRefId(refId: string) {
    const article = await this.databaseService.findGlobalById(refId)

    if (!article) {
      throw new BizException(ErrorCodeEnum.ContentNotFound)
    }
    const summaries = await this.aiSummaryModel.find({
      refId,
    })

    return {
      summaries,
      article,
    }
  }

  async getAllSummaries(pager: PagerDto) {
    const { page, size } = pager
    const summaries = await this.aiSummaryModel.paginate(
      {},
      {
        page,
        limit: size,
        sort: {
          created: -1,
        },
        lean: true,
        leanWithId: true,
      },
    )
    const data = transformDataToPaginate(summaries)

    return {
      ...data,
      articles: await this.getRefArticles(summaries.docs),
    }
  }

  async getAllSummariesGrouped(query: GetSummariesGroupedQueryInput) {
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
          summaryCount: { $sum: 1 },
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

    const aggregateResult = await this.aiSummaryModel.aggregate(pipeline)

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

    // Get all summaries for these refIds
    const refIds = groupedRefIds.map((g: { _id: string }) => g._id)
    const summaries = await this.aiSummaryModel
      .find({ refId: { $in: refIds } })
      .sort({ created: -1 })
      .lean()

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
    const doc = await this.aiSummaryModel.findById(id)
    if (!doc) {
      throw new BizException(ErrorCodeEnum.ContentNotFoundCantProcess)
    }

    doc.summary = summary
    await doc.save()
    return doc
  }
  async getSummaryByArticleId(articleId: string, lang = DEFAULT_SUMMARY_LANG) {
    const { document } = await this.resolveArticleForSummary(articleId)
    return this.findValidSummary(articleId, lang, document.text)
  }

  async getSummaryById(id: string) {
    const doc = await this.aiSummaryModel.findById(id)
    if (!doc) {
      throw new BizException(ErrorCodeEnum.ContentNotFoundCantProcess)
    }
    return doc
  }

  async streamSummaryForArticle(
    articleId: string,
    options: { preferredLang?: string; acceptLanguage?: string },
  ): Promise<{
    events: AsyncIterable<AiStreamEvent>
    result: Promise<AISummaryModel>
  }> {
    const aiConfig = await this.configService.get('ai')
    const shouldGenerate =
      aiConfig?.enableAutoGenerateSummary && aiConfig.enableSummary

    if (!shouldGenerate) {
      throw new BizException(ErrorCodeEnum.AINotEnabled)
    }

    const targetLanguage = await this.getTargetLanguage(options)
    const { document } = await this.resolveArticleForSummary(articleId)

    // 检查数据库中是否已有有效摘要（hash 匹配）
    const existingSummary = await this.findValidSummary(
      articleId,
      targetLanguage,
      document.text,
    )

    if (existingSummary) {
      this.logger.debug(
        `Summary cache hit: article=${articleId} lang=${targetLanguage}`,
      )
      return this.wrapAsImmediateStream(existingSummary)
    }

    return this.runSummaryGeneration(articleId, targetLanguage, document)
  }

  async getOrGenerateSummaryForArticle(
    articleId: string,
    options: {
      preferredLang?: string
      acceptLanguage?: string
      onlyDb?: boolean
    },
  ) {
    const { onlyDb } = options

    const targetLanguage = await this.getTargetLanguage(options)
    const dbStored = await this.getSummaryByArticleId(articleId, targetLanguage)

    if (dbStored) {
      return dbStored
    }

    if (onlyDb) {
      return null
    }

    const aiConfig = await this.configService.get('ai')
    const shouldGenerate =
      aiConfig?.enableAutoGenerateSummary && aiConfig.enableSummary

    if (shouldGenerate) {
      return this.generateSummaryByOpenAI(articleId, targetLanguage)
    }

    if (!aiConfig.enableSummary || !aiConfig.enableAutoGenerateSummary) {
      throw new BizException(ErrorCodeEnum.AINotEnabled)
    }

    return null
  }

  async deleteSummaryByArticleId(articleId: string) {
    await this.aiSummaryModel.deleteMany({
      refId: articleId,
    })
  }

  async deleteSummaryInDb(id: string) {
    await this.aiSummaryModel.deleteOne({
      _id: id,
    })
  }

  @OnEvent(BusinessEvents.POST_DELETE)
  @OnEvent(BusinessEvents.NOTE_DELETE)
  async handleDeleteArticle(event: { id: string }) {
    await this.deleteSummaryByArticleId(event.id)
  }

  @OnEvent(BusinessEvents.POST_CREATE)
  @OnEvent(BusinessEvents.NOTE_CREATE)
  async handleCreateArticle(event: { id: string }) {
    const enableAutoGenerate = await this.configService
      .get('ai')
      .then((c) => c.enableAutoGenerateSummary && c.enableSummary)
    if (!enableAutoGenerate) {
      return
    }
    const targetLanguage = await this.configService
      .get('ai')
      .then((c) => c.aiSummaryTargetLanguage || DEFAULT_SUMMARY_LANG)

    await this.generateSummaryByOpenAI(
      event.id,
      targetLanguage === 'auto' ? DEFAULT_SUMMARY_LANG : targetLanguage,
    )
  }
}
