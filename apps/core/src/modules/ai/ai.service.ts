import OpenAI from 'openai'
import removeMdCodeblock from 'remove-md-codeblock'
import type { PagerDto } from '~/shared/dto/pager.dto'

import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'

import { BizException } from '~/common/exceptions/biz.exception'
import { BusinessEvents } from '~/constants/business-event.constant'
import { CollectionRefTypes } from '~/constants/db.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { DatabaseService } from '~/processors/database/database.service'
import { CacheService } from '~/processors/redis/cache.service'
import { InjectModel } from '~/transformers/model.transformer'
import { transformDataToPaginate } from '~/transformers/paginate.transformer'
import { md5 } from '~/utils'

import { ConfigsService } from '../configs/configs.service'
import { AISummaryModel } from './ai-summary.model'

@Injectable()
export class AiService {
  private readonly logger: Logger
  constructor(
    @InjectModel(AISummaryModel)
    private readonly aiSummaryModel: MongooseModel<AISummaryModel>,
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigsService,

    private readonly cacheService: CacheService,
  ) {
    this.logger = new Logger(AiService.name)
  }

  private cachedTaskId2AiPromise = new Map<string, Promise<any>>()

  private serializeText(text: string) {
    return removeMdCodeblock(text)
  }
  async generateSummaryByOpenAI(articleId: string, lang = 'zh-CN') {
    const {
      ai: { enableSummary, openAiEndpoint, openAiKey },
    } = await this.configService.waitForConfigReady()

    if (!enableSummary) {
      throw new BizException(ErrorCodeEnum.AINotEnabled)
    }
    if (!openAiKey) {
      throw new BizException(ErrorCodeEnum.AIKeyExpired)
    }
    const openai = new OpenAI({
      apiKey: openAiKey,
      baseURL: openAiEndpoint || void 0,
      fetch: isDev ? fetch : void 0,
    })

    const article = await this.databaseService.findGlobalById(articleId)
    if (!article) {
      throw new BizException(ErrorCodeEnum.ContentNotFoundCantProcess)
    }

    if (article.type === CollectionRefTypes.Recently) {
      throw new BizException(ErrorCodeEnum.ContentNotFoundCantProcess)
    }

    const taskId = `ai:summary:${articleId}:${lang}`
    try {
      if (this.cachedTaskId2AiPromise.has(taskId)) {
        return this.cachedTaskId2AiPromise.get(taskId)
      }
      const redis = this.cacheService.getClient()

      const isProcessing = await redis.get(taskId)

      if (isProcessing === 'processing') {
        throw new BizException(ErrorCodeEnum.AIProcessing)
      }

      const taskPromise = handle.bind(this)(
        articleId,
        this.serializeText(article.document.text),
      ) as Promise<any>

      this.cachedTaskId2AiPromise.set(taskId, taskPromise)
      return await taskPromise
      // eslint-disable-next-line no-inner-declarations
      async function handle(this: AiService, id: string, text: string) {
        // 等待 30s
        await redis.set(taskId, 'processing', 'EX', 30)

        const completion = await openai.chat.completions.create({
          messages: [
            {
              role: 'user',
              content: `Summarize this article in "${lang}" language about 150 characters:
"${text}"

CONCISE SUMMARY:`,
            },
          ],
          model: 'gpt-3.5-turbo',
        })

        await redis.del(taskId)

        const summary = completion.choices[0].message.content

        this.logger.log(
          `OpenAI 生成文章 ${articleId} 的摘要花费了 ${completion.usage?.total_tokens}token`,
        )
        const contentMd5 = md5(text)

        const doc = await this.aiSummaryModel.create({
          hash: contentMd5,
          lang,
          refId: id,
          summary,
        })

        return doc
      }
    } catch (er) {
      this.logger.error(`OpenAI 在处理文章 ${articleId} 时出错：${er.message}`)

      throw new BizException(ErrorCodeEnum.AIException, er.message)
    } finally {
      this.cachedTaskId2AiPromise.delete(taskId)
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
      {
        page,
        limit: size,
        sort: {
          created: -1,
        },
      },
      {
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

  private getRefArticles(docs: AISummaryModel[]) {
    return this.databaseService
      .findGlobalByIds(docs.map((d) => d.refId))
      .then((articles) => {
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
        return articleMap
      })
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
  async getSummaryByArticleId(articleId: string, lang = 'zh-CN') {
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
    await this.generateSummaryByOpenAI(event.id)
  }
}
