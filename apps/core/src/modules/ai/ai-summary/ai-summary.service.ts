import removeMdCodeblock from 'remove-md-codeblock'
import type { PagerDto } from '~/shared/dto/pager.dto'

import { JsonOutputToolsParser } from '@langchain/core/output_parsers/openai_tools'
import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'

import { BizException } from '~/common/exceptions/biz.exception'
import { BusinessEvents } from '~/constants/business-event.constant'
import { CollectionRefTypes } from '~/constants/db.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { DatabaseService } from '~/processors/database/database.service'
import { RedisService } from '~/processors/redis/redis.service'
import { InjectModel } from '~/transformers/model.transformer'
import { transformDataToPaginate } from '~/transformers/paginate.transformer'
import { md5 } from '~/utils/tool.util'

import { ConfigsService } from '../../configs/configs.service'
import { DEFAULT_SUMMARY_LANG, LANGUAGE_CODE_TO_NAME } from '../ai.constants'
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

  private cachedTaskId2AiPromise = new Map<string, Promise<any>>()

  private serializeText(text: string) {
    return removeMdCodeblock(text)
  }

  private async summaryChain(articleId: string, lang = DEFAULT_SUMMARY_LANG) {
    const {
      ai: { enableSummary },
    } = await this.configService.waitForConfigReady()

    if (!enableSummary) {
      throw new BizException(ErrorCodeEnum.AINotEnabled)
    }

    const openai = await this.aiService.getOpenAiChain()

    const article = await this.databaseService.findGlobalById(articleId)
    if (!article || article.type === CollectionRefTypes.Recently) {
      throw new BizException(ErrorCodeEnum.ContentNotFoundCantProcess)
    }

    const parser = new JsonOutputToolsParser()

    const runnable = openai
      .bind({
        tools: [
          {
            type: 'function',
            function: {
              name: 'extractor',
              description: `Extract the summary of the input text in the ${LANGUAGE_CODE_TO_NAME[lang] || LANGUAGE_CODE_TO_NAME[DEFAULT_SUMMARY_LANG]}, and the length of the summary is less than 150 words.`,
              parameters: {
                type: 'object',
                properties: {
                  summary: {
                    type: 'string',
                    description: `The summary of the input text in the ${LANGUAGE_CODE_TO_NAME[lang] || LANGUAGE_CODE_TO_NAME[DEFAULT_SUMMARY_LANG]}, and the length of the summary is less than 150 words.`,
                  },
                },
                required: ['summary'],
              },
            },
          },
        ],

        tool_choice: { type: 'function', function: { name: 'extractor' } },
      })
      .pipe(parser)
    const result = (await runnable.invoke([
      this.serializeText(article.document.text),
    ])) as any[]

    if (result.length === 0) {
      return {}
    }

    return result[0]?.args?.summary
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
        article.document.title,
      ) as Promise<any>

      this.cachedTaskId2AiPromise.set(taskId, taskPromise)
      return await taskPromise

      async function handle(this: AiSummaryService, id: string, text: string) {
        // 等待 30s
        await redis.set(taskId, 'processing', 'EX', 30)

        const summary = await this.summaryChain(id, lang)

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
      .then((c) => c.aiSummaryTargetLanguage)

    await this.generateSummaryByOpenAI(
      event.id,
      targetLanguage === 'auto' ? DEFAULT_SUMMARY_LANG : targetLanguage,
    )
  }
}
