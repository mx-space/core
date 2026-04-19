import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import removeMdCodeblock from 'remove-md-codeblock'

import { BizException } from '~/common/exceptions/biz.exception'
import { CollectionRefTypes } from '~/constants/db.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { DatabaseService } from '~/processors/database/database.service'
import {
  type TaskExecuteContext,
  TaskQueueProcessor,
} from '~/processors/task-queue'
import { InjectModel } from '~/transformers/model.transformer'
import { createAbortError } from '~/utils/abort.util'
import { md5 } from '~/utils/tool.util'

import { ConfigsService } from '../../configs/configs.service'
import { DEFAULT_SUMMARY_LANG } from '../ai.constants'
import { AiService } from '../ai.service'
import { AiInFlightService } from '../ai-inflight/ai-inflight.service'
import { AiTaskService } from '../ai-task/ai-task.service'
import { AITaskType, type InsightsTaskPayload } from '../ai-task/ai-task.types'
import { AIInsightsModel } from './ai-insights.model'

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

  // Placeholder; full generation added in Task A9
  async generateInsights(_articleId: string): Promise<AIInsightsModel> {
    throw new Error('generateInsights not yet implemented')
  }
}
