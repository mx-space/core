import type { PagerDto } from '~/shared/dto/pager.dto'

import { JsonOutputToolsParser } from '@langchain/core/output_parsers/openai_tools'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { GraphRecursionError } from '@langchain/langgraph'
import { createReactAgent } from '@langchain/langgraph/prebuilt'
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

    const llm = await this.aiService.getOpenAiChain({
      maxTokens: 8192,
    })

    const dataModel = {
      keyPoints: [] as string[],
      criticalAnalysis: '',
      content: '',
    }

    // 创建分析文章的工具
    const tools = [
      new DynamicStructuredTool({
        name: 'deep_reading',
        description: `获取深度阅读内容`,
        schema: z.object({}),
        func: async () => {
          const llm = await this.aiService.getOpenAiChain({
            maxTokens: 1024 * 10,
          })

          const result = await llm
            .bind({
              tool_choice: {
                type: 'function',
                function: { name: 'deep_reading' },
              },
              tools: [
                {
                  name: 'deep_reading',
                  type: 'function',
                  function: {
                    name: 'deep_reading',
                    parameters: {
                      type: 'object',
                      properties: {
                        content: {
                          type: 'string',
                          description: '深度阅读内容',
                        },
                      },
                      required: ['content'],
                    },
                    description: `创建一个全面的深度阅读Markdown文本，保持文章的原始结构但提供扩展的解释和见解。
内容应该：
1. 遵循原文的流程和主要论点
2. 包含原文的所有关键技术细节
3. 扩展未充分解释的复杂概念
4. 在需要的地方提供额外背景和解释
5. 保持文章的原始语调和语言风格
6. 使用适当的Markdown格式，包括标题、代码块、列表等
7. 输出的语言必须与原文的语言匹配`,
                  },
                },
              ],
            })

            .pipe(new JsonOutputToolsParser())
            .invoke([
              {
                content: `分析以下文章：${article.document.text}\n\n创建一个全面的深度阅读Markdown文本，保持文章的原始结构但提供扩展的解释和见解。`,
                role: 'system',
              },
            ])
            .then((result: any[]) => {
              const content = result[0]?.args?.content
              dataModel.content = content
              return content
            })
          return result
        },
      }),
      new DynamicStructuredTool({
        name: 'save_key_points',
        description: '保存关键点到数据库',
        schema: z.object({
          keyPoints: z.array(z.string()).describe('关键点数组'),
        }),
        func: async (data: { keyPoints: string[] }) => {
          dataModel.keyPoints = data.keyPoints
          return '关键点已保存'
        },
      }),

      new DynamicStructuredTool({
        name: 'save_critical_analysis',
        description: '保存批判性分析到数据库',
        schema: z.object({
          criticalAnalysis: z.string().describe('批判性分析'),
        }),
        func: async (data: { criticalAnalysis: string }) => {
          dataModel.criticalAnalysis = data.criticalAnalysis
          return '批判性分析已保存'
        },
      }),
    ]

    // 创建系统提示模板
    const systemPrompt = `你是一个专门进行文章深度阅读的AI助手，需要分析文章并提供详细的解读。
分析过程：
1. 首先提取文章关键点，然后使用 save_key_points 保存到数据库
2. 然后进行批判性分析，包括文章的优点、缺点和改进建议，然后使用 save_critical_analysis 保存到数据库
3. 最后使用 deep_reading 生成完整的深度阅读内容
4. 返回完整结果，包括关键点、批判性分析和深度阅读内容`

    try {
      // 创建LangGraph React Agent
      const agent = createReactAgent({
        llm,
        tools,
      })

      await agent.invoke(
        {
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: `文章标题: ${article.document.title}\n文章内容: ${article.document.text}`,
            },
          ],
        },
        {
          recursionLimit: 10, // 相当于以前的maxIterations
        },
      )

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

      if (error instanceof GraphRecursionError) {
        this.logger.error(
          `LangGraph recursion limit reached for article ${articleId}: ${error.message}`,
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
