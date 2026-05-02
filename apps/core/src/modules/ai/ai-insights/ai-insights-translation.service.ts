import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'

import { BizException } from '~/common/exceptions/biz.exception'
import { BusinessEvents } from '~/constants/business-event.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import {
  type TaskExecuteContext,
  TaskQueueProcessor,
} from '~/processors/task-queue'
import { md5 } from '~/utils/tool.util'

import { ConfigsService } from '../../configs/configs.service'
import {
  AI_STREAM_IDLE_TIMEOUT_MS,
  AI_STREAM_LOCK_TTL,
  AI_STREAM_MAXLEN,
  AI_STREAM_READ_BLOCK_MS,
  AI_STREAM_RESULT_TTL,
} from '../ai.constants'
import { AI_PROMPTS } from '../ai.prompts'
import { AiService } from '../ai.service'
import { AiInFlightService } from '../ai-inflight/ai-inflight.service'
import { AiTaskService } from '../ai-task/ai-task.service'
import {
  AITaskType,
  type InsightsTranslationTaskPayload,
} from '../ai-task/ai-task.types'
import { AIInsightsModel } from './ai-insights.model'
import {
  AiInsightsRepository,
  type AiInsightsRow,
} from './ai-insights.repository'
import { stripTopLevelCodeFence } from './insights.util'

@Injectable()
export class AiInsightsTranslationService implements OnModuleInit {
  private readonly logger = new Logger(AiInsightsTranslationService.name)

  constructor(
    private readonly aiInsightsRepository: AiInsightsRepository,
    private readonly configService: ConfigsService,
    private readonly aiService: AiService,
    private readonly aiInFlightService: AiInFlightService,
    private readonly taskProcessor: TaskQueueProcessor,
    private readonly aiTaskService: AiTaskService,
  ) {}

  private toInsightsDoc(row: AiInsightsRow | null): AIInsightsModel | null {
    if (!row) return null
    return {
      ...row,
      _id: row.id,
      created: row.createdAt,
    } as unknown as AIInsightsModel
  }

  onModuleInit() {
    this.taskProcessor.registerHandler({
      type: AITaskType.InsightsTranslation,
      execute: async (
        payload: InsightsTranslationTaskPayload,
        context: TaskExecuteContext,
      ) => {
        if (context.isAborted()) return
        await context.updateProgress(0, 'Translating insights', 0, 1)
        const result = await this.translateInsights(payload)
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
    const targets = (aiConfig.insightsTargetLanguages || []).filter(
      (lang: string) => lang && lang !== event.sourceLang,
    )
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
  ): Promise<AIInsightsModel> {
    const source = this.toInsightsDoc(
      await this.aiInsightsRepository.findById(payload.sourceInsightsId),
    )
    if (!source || source.isTranslation) {
      throw new BizException(ErrorCodeEnum.ContentNotFoundCantProcess)
    }
    const key = md5(
      JSON.stringify({
        feature: 'insights.translation',
        refId: payload.refId,
        lang: payload.targetLang,
        sourceHash: source.hash,
      }),
    )
    const { result } =
      await this.aiInFlightService.runWithStream<AIInsightsModel>({
        key,
        lockTtlSec: AI_STREAM_LOCK_TTL,
        resultTtlSec: AI_STREAM_RESULT_TTL,
        streamMaxLen: AI_STREAM_MAXLEN,
        readBlockMs: AI_STREAM_READ_BLOCK_MS,
        idleTimeoutMs: AI_STREAM_IDLE_TIMEOUT_MS,
        onLeader: async ({ push }) => {
          const runtime = await this.aiService.getInsightsTranslationModel()
          const { systemPrompt, prompt, reasoningEffort } =
            AI_PROMPTS.insightsTranslation(payload.targetLang, source.content)
          const messages = [
            { role: 'system' as const, content: systemPrompt },
            { role: 'user' as const, content: prompt },
          ]
          let raw = ''
          if (runtime.generateTextStream) {
            for await (const chunk of runtime.generateTextStream({
              messages,
              temperature: 0.3,
              maxRetries: 2,
              reasoningEffort,
            })) {
              raw += chunk.text
              if (push) await push({ type: 'token', data: chunk.text })
            }
          } else {
            const out = await runtime.generateText({
              messages,
              temperature: 0.3,
              maxRetries: 2,
              reasoningEffort,
            })
            raw = out.text
            if (push && out.text) await push({ type: 'token', data: out.text })
          }
          const translatedText = stripTopLevelCodeFence(raw).trim()
          if (!translatedText) {
            throw new BizException(
              ErrorCodeEnum.AIException,
              'Insights translation returned empty content',
            )
          }
          const doc = this.toInsightsDoc(
            await this.aiInsightsRepository.upsert({
              refId: payload.refId,
              lang: payload.targetLang,
              hash: source.hash,
              content: translatedText,
              isTranslation: true,
              sourceInsightsId: source.id,
              sourceLang: source.sourceLang || source.lang,
            }),
          )!
          return { result: doc, resultId: doc.id }
        },
        parseResult: async (resultId) => {
          const doc = this.toInsightsDoc(
            await this.aiInsightsRepository.findById(resultId),
          )
          if (!doc)
            throw new BizException(ErrorCodeEnum.ContentNotFoundCantProcess)
          return doc
        },
      })
    return result
  }
}
