import { Injectable, type OnModuleInit } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'

import { AppErrorCode, createAppException } from '~/common/errors'
import { BusinessEvents } from '~/constants/business-event.constant'
import {
  type TaskExecuteContext,
  TaskQueueProcessor,
} from '~/processors/task-queue'

import { ConfigsService } from '../../configs/configs.service'
import { normalizeTargetLangs } from '../ai-language.util'
import { MultilangGenerationService } from '../ai-multilang/ai-multilang.service'
import { AiTaskService } from '../ai-task/ai-task.service'
import {
  AITaskType,
  type InsightsTranslationTaskPayload,
} from '../ai-task/ai-task.types'
import { AiInsightsAdapter } from './ai-insights.adapter'
import { AiInsightsRepository } from './ai-insights.repository'
import { type AIInsightsModel } from './ai-insights.types'

@Injectable()
export class AiInsightsTranslationService implements OnModuleInit {
  constructor(
    private readonly aiInsightsRepository: AiInsightsRepository,
    private readonly configService: ConfigsService,
    private readonly adapter: AiInsightsAdapter,
    private readonly multilang: MultilangGenerationService,
    private readonly taskProcessor: TaskQueueProcessor,
    private readonly aiTaskService: AiTaskService,
  ) {}

  onModuleInit() {
    this.taskProcessor.registerHandler({
      type: AITaskType.InsightsTranslation,
      execute: async (
        payload: InsightsTranslationTaskPayload,
        context: TaskExecuteContext,
      ) => {
        if (context.isAborted()) return
        await context.updateProgress(0, 'Translating insights', 0, 1)
        const result = await this.translateInsights(payload, context)
        await context.setResult({ insightsId: result.id, lang: result.lang })
        await context.updateProgress(100, 'Done', 1, 1)
      },
    })
  }

  @OnEvent(BusinessEvents.INSIGHTS_GENERATED)
  async handleInsightsGenerated(event: {
    refId: string
    sourceLang: string
    insightsId: string
    sourceHash: string
  }) {
    const aiConfig = await this.configService.get('ai')
    if (!aiConfig?.enableInsights || !aiConfig.enableAutoTranslateInsights) {
      return
    }
    const targets = normalizeTargetLangs(
      aiConfig.insightsTargetLanguages,
    ).filter((lang) => lang !== event.sourceLang)
    for (const targetLang of targets) {
      const existing = await this.aiInsightsRepository.findByRefAndLang(
        event.refId,
        targetLang,
      )
      if (existing?.hash === event.sourceHash) continue
      await this.aiTaskService.createInsightsTranslationTask({
        refId: event.refId,
        sourceInsightsId: event.insightsId,
        targetLang,
      })
    }
  }

  async translateInsights(
    payload: InsightsTranslationTaskPayload,
    context?: TaskExecuteContext,
  ): Promise<AIInsightsModel> {
    const source = await this.adapter.findById(payload.sourceInsightsId)
    if (!source || source.isTranslation) {
      throw createAppException(AppErrorCode.CONTENT_NOT_FOUND_CANT_PROCESS, {
        message: 'Source insights not found or already translated',
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
}
