import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { BizException } from '~/common/exceptions/biz.exception'
import { BusinessEvents } from '~/constants/business-event.constant'
import { CollectionRefTypes } from '~/constants/db.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { DatabaseService } from '~/processors/database/database.service'
import { RedisService } from '~/processors/redis/redis.service'
import type { PagerDto } from '~/shared/dto/pager.dto'
import { InjectModel } from '~/transformers/model.transformer'
import { transformDataToPaginate } from '~/transformers/paginate.transformer'
import { md5 } from '~/utils/tool.util'
import { generateObject } from 'ai'
import removeMdCodeblock from 'remove-md-codeblock'
import { z } from 'zod'
import { ConfigsService } from '../../configs/configs.service'
import { AI_TASK_LOCK_TTL, DEFAULT_SUMMARY_LANG } from '../ai.constants'
import { AI_PROMPTS } from '../ai.prompts'
import { AiService } from '../ai.service'
import { AISummaryModel } from './ai-summary.model'

@Injectable()
export class AiSummaryService {
  private readonly logger: Logger
  constructor(
    @InjectModel(AISummaryModel)
    private readonly aiSummaryModel: MongooseModel<AISummaryModel>,
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigsService,

    private readonly redisService: RedisService,
    private readonly aiService: AiService,
  ) {
    this.logger = new Logger(AiSummaryService.name)
  }

  private cachedTaskId2AiPromise = new Map<string, Promise<AISummaryModel>>()

  private serializeText(text: string) {
    return removeMdCodeblock(text)
  }

  private async generateSummaryViaAI(text: string, lang: string) {
    const model = await this.aiService.getSummaryModel()

    const { object } = await generateObject({
      model: model as Parameters<typeof generateObject>[0]['model'],
      schema: z.object({
        summary: z
          .string()
          .describe(AI_PROMPTS.summary.getSummaryDescription(lang)),
      }),
      prompt: AI_PROMPTS.summary.getSummaryPrompt(
        lang,
        this.serializeText(text),
      ),
      temperature: 0.5,
      maxRetries: 2,
    })

    return object.summary
  }
  async generateSummaryByOpenAI(articleId: string, lang: string) {
    const {
      ai: { enableSummary },
    } = await this.configService.waitForConfigReady()

    if (!enableSummary) {
      throw new BizException(ErrorCodeEnum.AINotEnabled)
    }

    const article = await this.databaseService.findGlobalById(articleId)
    if (!article) {
      throw new BizException(ErrorCodeEnum.ContentNotFoundCantProcess)
    }

    if (article.type === CollectionRefTypes.Recently) {
      throw new BizException(ErrorCodeEnum.ContentNotFoundCantProcess)
    }

    const taskId = `ai:summary:${articleId}:${lang}`
    const redis = this.redisService.getClient()
    try {
      if (this.cachedTaskId2AiPromise.has(taskId)) {
        return this.cachedTaskId2AiPromise.get(taskId)
      }

      const isProcessing = await redis.get(taskId)

      if (isProcessing === 'processing') {
        throw new BizException(ErrorCodeEnum.AIProcessing)
      }

      const taskPromise = handle.bind(this)(
        articleId,
        this.serializeText(article.document.text),
      )

      this.cachedTaskId2AiPromise.set(taskId, taskPromise)
      return await taskPromise

      async function handle(this: AiSummaryService, id: string, text: string) {
        await redis.set(taskId, 'processing', 'EX', AI_TASK_LOCK_TTL)

        const summary = await this.generateSummaryViaAI(text, lang)

        const contentMd5 = md5(text)

        const doc = await this.aiSummaryModel.create({
          hash: contentMd5,
          lang,
          refId: id,
          summary,
        })

        return doc
      }
    } catch (error) {
      this.logger.error(
        `OpenAI 在处理文章 ${articleId} 时出错：${error.message}`,
        error.stack,
      )

      throw new BizException(ErrorCodeEnum.AIException, error.message)
    } finally {
      this.cachedTaskId2AiPromise.delete(taskId)
      await redis.del(taskId)
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

  async getAllSummariesGrouped(pager: PagerDto) {
    const { page, size } = pager

    // First, get unique refIds with pagination
    const aggregateResult = await this.aiSummaryModel.aggregate([
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
    ])

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
    const article = await this.databaseService.findGlobalById(articleId)
    if (!article) {
      throw new BizException(ErrorCodeEnum.ContentNotFoundCantProcess)
    }

    if (article.type === CollectionRefTypes.Recently) {
      throw new BizException(ErrorCodeEnum.ContentNotFoundCantProcess)
    }

    const contentMd5 = md5(this.serializeText(article.document.text))
    const doc = await this.aiSummaryModel.findOne({
      hash: contentMd5,

      lang,
    })

    return doc
  }

  async getOrGenerateSummaryForArticle(
    articleId: string,
    options: {
      preferredLang?: string
      acceptLanguage?: string
      onlyDb?: boolean
    },
  ) {
    const { preferredLang, acceptLanguage, onlyDb } = options

    const nextLang = preferredLang || acceptLanguage
    const autoDetectedLanguage =
      nextLang?.split('-').shift() || DEFAULT_SUMMARY_LANG

    const aiSummaryTargetLanguage = await this.configService
      .get('ai')
      .then((c) => c.aiSummaryTargetLanguage || DEFAULT_SUMMARY_LANG)

    const targetLanguage =
      aiSummaryTargetLanguage === 'auto'
        ? autoDetectedLanguage
        : aiSummaryTargetLanguage

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
