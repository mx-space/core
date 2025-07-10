import { generateText, tool } from 'ai'
import type { PagerDto } from '~/shared/dto/pager.dto'

import { z } from '@mx-space/compiled/zod'
import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'

import { BizException } from '~/common/exceptions/biz.exception'
import { CollectionRefTypes } from '~/constants/db.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { DatabaseService } from '~/processors/database/database.service'
import { RedisService } from '~/processors/redis/redis.service'
import { InjectModel } from '~/transformers/model.transformer'
import { md5 } from '~/utils/tool.util'

import { ConfigsService } from '../../configs/configs.service'
import { AI_PROMPTS } from '../ai.prompts'
import { AiService } from '../ai.service'
import { AIDeepReadingModel } from './ai-deep-reading.model'

@Injectable()
export class AiDeepReadingService {
  private readonly logger: Logger
  constructor(
    @InjectModel(AIDeepReadingModel)
    private readonly aiDeepReadingModel: MongooseModel<AIDeepReadingModel>,
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigsService,

    private readonly redisService: RedisService,
    private readonly aiService: AiService,
  ) {
    this.logger = new Logger(AiDeepReadingService.name)
  }

  private cachedTaskId2AiPromise = new Map<string, Promise<any>>()

  private async deepReadingAgentChain(articleId: string) {
    const {
      ai: { enableDeepReading },
    } = await this.configService.waitForConfigReady()

    if (!enableDeepReading) {
      throw new BizException(ErrorCodeEnum.AINotEnabled)
    }

    const article = await this.databaseService.findGlobalById(articleId)
    if (!article || article.type === CollectionRefTypes.Recently) {
      throw new BizException(ErrorCodeEnum.ContentNotFoundCantProcess)
    }

    const model = await this.aiService.getOpenAiModel()

    const dataModel = {
      keyPoints: [] as string[],
      criticalAnalysis: '',
      content: '',
    }

    // 定义工具
    const tools = {
      deep_reading: tool({
        description: '获取深度阅读内容',
        parameters: z.object({}),
        execute: async () => {
          const { text } = await generateText({
            model,
            system: AI_PROMPTS.deepReading.deepReadingSystem,
            prompt: AI_PROMPTS.deepReading.getDeepReadingPrompt(
              article.document.text,
            ),
            maxTokens: 10240,
          })

          dataModel.content = text
          return text
        },
      }),
      save_key_points: tool({
        description: '保存关键点到数据库',
        parameters: z.object({
          keyPoints: z.array(z.string()).describe('关键点数组'),
        }),
        execute: async ({ keyPoints }) => {
          dataModel.keyPoints = keyPoints
          return '关键点已保存'
        },
      }),
      save_critical_analysis: tool({
        description: '保存批判性分析到数据库',
        parameters: z.object({
          criticalAnalysis: z.string().describe('批判性分析'),
        }),
        execute: async ({ criticalAnalysis }) => {
          dataModel.criticalAnalysis = criticalAnalysis
          return '批判性分析已保存'
        },
      }),
    }

    try {
      // 使用Vercel AI SDK执行多步骤工具调用
      await generateText({
        model,
        tools,
        system: AI_PROMPTS.deepReading.systemPrompt,
        prompt: AI_PROMPTS.deepReading.getUserPrompt(
          article.document.title,
          article.document.text,
        ),
        maxSteps: 10,
      })

      return {
        keyPoints: dataModel.keyPoints,
        criticalAnalysis: dataModel.criticalAnalysis,
        content: dataModel.content,
      }
    } catch (error) {
      this.logger.error(`Agent execution error: ${error.message}`)
      throw new BizException(
        ErrorCodeEnum.AIException,
        error.message,
        error.stack,
      )
    }
  }

  async generateDeepReadingByOpenAI(articleId: string) {
    const {
      ai: { enableDeepReading },
    } = await this.configService.waitForConfigReady()

    if (!enableDeepReading) {
      throw new BizException(ErrorCodeEnum.AINotEnabled)
    }

    const article = await this.databaseService.findGlobalById(articleId)
    if (!article) {
      throw new BizException(ErrorCodeEnum.ContentNotFoundCantProcess)
    }

    if (article.type === CollectionRefTypes.Recently) {
      throw new BizException(ErrorCodeEnum.ContentNotFoundCantProcess)
    }

    const taskId = `ai:deepreading:${articleId}`
    const redis = this.redisService.getClient()
    try {
      if (this.cachedTaskId2AiPromise.has(taskId)) {
        return this.cachedTaskId2AiPromise.get(taskId)
      }

      const isProcessing = await redis.get(taskId)

      if (isProcessing === 'processing' && !isDev) {
        throw new BizException(ErrorCodeEnum.AIProcessing)
      }

      const taskPromise = handle.bind(this)(
        articleId,
        article.document.text,
        article.document.title,
      ) as Promise<any>

      this.cachedTaskId2AiPromise.set(taskId, taskPromise)
      return await taskPromise

      async function handle(
        this: AiDeepReadingService,
        id: string,
        text: string,
      ) {
        // 处理时间增加到5分钟
        await redis.set(taskId, 'processing', 'EX', 300)

        const result = await this.deepReadingAgentChain(id)

        const contentMd5 = md5(text)

        const doc = await this.aiDeepReadingModel.create({
          hash: contentMd5,
          refId: id,
          keyPoints: result.keyPoints,
          criticalAnalysis: result.criticalAnalysis,
          content: result.content,
        })

        return doc
      }
    } catch (error) {
      console.error(error)

      if (
        error.message?.includes('limit reached') ||
        error.message?.includes('maximum')
      ) {
        this.logger.error(
          `AI processing iteration limit reached for article ${articleId}: ${error.message}`,
        )
        throw new BizException(
          ErrorCodeEnum.AIException,
          'AI处理迭代次数超过限制',
          error.stack,
        )
      }

      this.logger.error(
        `OpenAI encountered an error processing article ${articleId}: ${error.message}`,
      )

      throw new BizException(
        ErrorCodeEnum.AIException,
        error.message,
        error.stack,
      )
    } finally {
      this.cachedTaskId2AiPromise.delete(taskId)
      await redis.del(taskId)
    }
  }

  async getAllDeepReadings(pager: PagerDto) {
    const { page, size } = pager
    const deepReadings = await this.aiDeepReadingModel.paginate(
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
    return deepReadings
  }

  async getDeepReadingByArticleId(articleId: string) {
    const article = await this.databaseService.findGlobalById(articleId)
    if (!article) {
      throw new BizException(ErrorCodeEnum.ContentNotFound)
    }

    const docs = await this.aiDeepReadingModel.find({
      refId: articleId,
    })

    return docs[0]
  }

  async deleteDeepReadingByArticleId(articleId: string) {
    await this.aiDeepReadingModel.deleteMany({
      refId: articleId,
    })
  }

  async deleteDeepReadingInDb(id: string) {
    return this.aiDeepReadingModel.findByIdAndDelete(id)
  }

  @OnEvent('article.delete')
  async handleDeleteArticle(event: { id: string }) {
    await this.deleteDeepReadingByArticleId(event.id)
  }
}
