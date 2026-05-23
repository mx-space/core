import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  type OnModuleInit,
} from '@nestjs/common'

import { AppErrorCode } from '~/common/errors'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import {
  type TaskExecuteContext,
  TaskQueueProcessor,
} from '~/processors/task-queue'

import { ConfigsService } from '../../../configs/configs.service'
import { AiService } from '../../ai.service'
import { AiEmbeddingsService } from '../../ai-embeddings/ai-embeddings.service'
import { AiMemoryService } from '../../ai-memory/ai-memory.service'
import { AiPersonaService } from '../../ai-persona/ai-persona.service'
import { tryGetPersonaDefinition } from '../../ai-persona/persona-registry'
import {
  AITaskType,
  type EchoGenerateTaskPayload,
} from '../../ai-task/ai-task.types'
import { ECHO_DEFAULTS } from '../ai-echo.constants'
import { AiEchoRepository } from '../ai-echo.repository'
import type { AiEchoMetadata } from '../ai-echo.types'
import { EchoScenarioRegistry } from '../echo-scenario.registry'

@Injectable()
export class EchoGenerateTaskProcessor implements OnModuleInit {
  private readonly logger = new Logger(EchoGenerateTaskProcessor.name)

  constructor(
    private readonly taskProcessor: TaskQueueProcessor,
    private readonly repository: AiEchoRepository,
    @Inject(forwardRef(() => AiService))
    private readonly aiService: AiService,
    private readonly aiEmbeddingsService: AiEmbeddingsService,
    private readonly aiMemoryService: AiMemoryService,
    private readonly aiPersonaService: AiPersonaService,
    private readonly configsService: ConfigsService,
    private readonly eventManager: EventManagerService,
    private readonly registry: EchoScenarioRegistry,
  ) {}

  onModuleInit() {
    this.taskProcessor.registerHandler<EchoGenerateTaskPayload>({
      type: AITaskType.EchoGenerate,
      execute: (payload, context) => this.handle(payload, context),
    })
    this.logger.log('Echo generate task handler registered')
  }

  async handle(
    payload: EchoGenerateTaskPayload,
    context: TaskExecuteContext,
  ): Promise<void> {
    const { echoId } = payload
    const row = await this.repository.findById(echoId)
    if (!row) {
      await context.appendLog('warn', `Echo not found: ${echoId}`)
      return
    }
    if (row.status !== 'pending' && row.status !== 'generating') {
      await context.appendLog(
        'info',
        `Echo status=${row.status}; skipping generation`,
      )
      return
    }

    await this.repository.update(echoId, { status: 'generating' })

    const scenario = this.registry.get(row.scenarioKey)
    if (!scenario) {
      await this.terminalFail(
        echoId,
        AppErrorCode.AI_ECHO_SCENARIO_NOT_REGISTERED,
        `Scenario "${row.scenarioKey}" not registered`,
      )
      return
    }

    let subject: unknown
    try {
      subject = await scenario.loadSubject(row.subjectId)
    } catch (error) {
      await this.terminalFail(
        echoId,
        AppErrorCode.AI_ECHO_SUBJECT_NOT_FOUND,
        (error as Error).message,
      )
      return
    }
    if (!subject) {
      await this.terminalFail(
        echoId,
        AppErrorCode.AI_ECHO_SUBJECT_NOT_FOUND,
        `subject ${row.subjectType}:${row.subjectId} not found`,
      )
      return
    }

    const persona = tryGetPersonaDefinition(row.personaKey)
    if (!persona) {
      await this.terminalFail(
        echoId,
        AppErrorCode.AI_PERSONA_NOT_FOUND,
        `persona "${row.personaKey}" not found`,
      )
      return
    }

    const aiConfig = await this.configsService.get('ai').catch(() => null)
    const topK = aiConfig?.echoRetrievalTopK ?? ECHO_DEFAULTS.retrievalTopK
    const minSimilarity =
      aiConfig?.echoRetrievalMinSimilarity ??
      ECHO_DEFAULTS.retrievalMinSimilarity
    const exemplarsCount =
      aiConfig?.echoExemplarsCount ?? ECHO_DEFAULTS.exemplarsCount

    const profile = persona.needsProfile
      ? await this.aiPersonaService
          .getProfileOrNull(persona.key)
          .catch(() => null)
      : null

    const query = scenario.extractRetrievalQuery(subject)

    const retrieval =
      persona.needsRetrieval && query
        ? await this.aiEmbeddingsService
            .search(query, {
              topK,
              minSimilarity,
              sourceTypes: ['note', 'page'],
            })
            .catch((error) => {
              this.logger.warn(
                `Echo retrieval failed: ${(error as Error).message}`,
              )
              return []
            })
        : []

    const memories = await this.aiMemoryService
      .recall({
        scope: ['global', `persona:${persona.key}`],
        query: query ?? undefined,
        topK,
        minSimilarity,
      })
      .catch((error) => {
        this.logger.warn(`Echo recall failed: ${(error as Error).message}`)
        return []
      })

    const exemplars = persona.usesExemplars
      ? await this.aiPersonaService
          .pickExemplars(persona.key, { count: exemplarsCount })
          .catch(() => [])
      : []

    const messages = scenario.buildPrompt({
      subject,
      persona,
      profile,
      retrieval,
      memories,
      exemplars,
    })

    let runtime
    try {
      runtime = await this.aiService.getEchoModel()
    } catch (error) {
      await this.terminalFail(
        echoId,
        AppErrorCode.AI_ECHO_MODEL_NOT_CONFIGURED,
        (error as Error).message,
      )
      return
    }

    let result
    try {
      result = await runtime.generateText({
        messages,
        temperature: 0.7,
        maxRetries: 2,
      })
    } catch (error) {
      await this.terminalFail(
        echoId,
        AppErrorCode.AI_ECHO_GENERATION_FAILED,
        (error as Error).message,
      )
      throw error
    }
    const finalContent =
      scenario.postProcess?.(result.text, subject) ?? result.text

    const metadataPatch: AiEchoMetadata = {
      ...row.metadata,
      retrievalIds: retrieval.map(
        (r) => `${r.sourceType}:${r.sourceId}#${r.chunkIndex}`,
      ),
      retrievalSimilarities: retrieval.map((r) => r.similarity),
      memoryIds: memories.map((m) => m.id),
      profileRefreshedAt: profile?.refreshedAt
        ? profile.refreshedAt.toISOString()
        : null,
    }

    const saved = await this.repository.update(echoId, {
      status: 'ready',
      content: finalContent,
      model: runtime.providerInfo.model,
      generatedAt: new Date(),
      metadata: metadataPatch,
    })

    if (saved && scenario.emitOnReady) {
      await this.eventManager.emit(
        scenario.emitOnReady as BusinessEvents,
        saved,
        { scope: EventScope.TO_SYSTEM_VISITOR },
      )
    }

    await context.appendLog('info', `Echo generated: ${echoId}`)
    if (result.usage?.totalTokens) {
      await context.incrementTokens(result.usage.totalTokens)
    }
  }

  private async terminalFail(
    echoId: string,
    code: AppErrorCode,
    message?: string,
  ): Promise<void> {
    const existing = await this.repository.findById(echoId)
    const truncated = message?.slice(0, ECHO_DEFAULTS.upstreamMessageMaxLen)
    await this.repository.update(echoId, {
      status: 'failed',
      metadata: {
        ...existing?.metadata,
        errorCode: code,
        upstreamMessage: truncated,
      },
    })
  }
}
