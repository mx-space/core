import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common'

import { AppErrorCode, createAppException } from '~/common/errors'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { RedisService } from '~/processors/redis/redis.service'

import { ConfigsService } from '../../configs/configs.service'
import { AiTaskService } from '../ai-task/ai-task.service'
import {
  AITaskType,
  type EchoGenerateTaskPayload,
} from '../ai-task/ai-task.types'
import { ECHO_DEFAULTS, ECHO_QUOTA_REDIS_KEY_PREFIX } from './ai-echo.constants'
import { AiEchoRepository } from './ai-echo.repository'
import type { AdminListEchoQueryInput } from './ai-echo.schema'
import type { AiEcho, AiEchoStatus } from './ai-echo.types'
import { EchoScenarioRegistry } from './echo-scenario.registry'
import type { EchoScenario } from './scenario.types'

interface DispatchResult {
  echoId: string
  taskId: string | null
  status: AiEchoStatus
}

@Injectable()
export class AiEchoService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AiEchoService.name)

  constructor(
    private readonly repository: AiEchoRepository,
    private readonly aiTaskService: AiTaskService,
    private readonly eventManager: EventManagerService,
    private readonly configsService: ConfigsService,
    private readonly redisService: RedisService,
    private readonly registry: EchoScenarioRegistry,
  ) {}

  onApplicationBootstrap() {
    for (const scenario of this.registry.list()) {
      if (!scenario.triggerEvent) continue
      this.eventManager.on(scenario.triggerEvent, async (payload) => {
        try {
          await this.handleTrigger(scenario, payload)
        } catch (error) {
          this.logger.error(
            `Echo trigger handler failed: scenario=${scenario.key} error=${(error as Error).message}`,
            (error as Error).stack,
          )
        }
      })
      this.logger.log(
        `Echo scenario "${scenario.key}" subscribed to ${scenario.triggerEvent}`,
      )
    }
  }

  getScenario(key: string): EchoScenario | undefined {
    return this.registry.get(key)
  }

  requireScenario(key: string): EchoScenario {
    const scenario = this.registry.get(key)
    if (!scenario) {
      throw createAppException(AppErrorCode.AI_ECHO_SCENARIO_NOT_REGISTERED, {
        scenarioKey: key,
      })
    }
    return scenario
  }

  listScenarios(): EchoScenario[] {
    return this.registry.list()
  }

  private async handleTrigger(
    scenario: EchoScenario,
    payload: unknown,
  ): Promise<void> {
    const aiConfig = await this.configsService.get('ai').catch(() => null)
    if (!aiConfig?.enableEcho) return
    if (!aiConfig.enableAutoGenerateEchoOnCreate) return

    const subjectId = this.extractSubjectId(payload)
    if (!subjectId) {
      this.logger.warn(
        `Echo trigger for scenario "${scenario.key}" missing subject id`,
      )
      return
    }
    await this.dispatch(scenario.key, scenario.key, subjectId)
  }

  private extractSubjectId(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') return null
    const obj = payload as Record<string, unknown>
    const direct = obj.id
    if (typeof direct === 'string') return direct
    const nested = obj.data
    if (nested && typeof nested === 'object') {
      const nestedId = (nested as Record<string, unknown>).id
      if (typeof nestedId === 'string') return nestedId
    }
    return null
  }

  async dispatch(
    scenarioKey: string,
    subjectType: string,
    subjectId: string,
  ): Promise<DispatchResult[]> {
    const scenario = this.requireScenario(scenarioKey)
    const results: DispatchResult[] = []
    for (const personaKey of scenario.defaultPersonas) {
      results.push(
        await this.enqueueOne(scenarioKey, subjectType, subjectId, personaKey),
      )
    }
    return results
  }

  async regenerate(
    subjectType: string,
    subjectId: string,
    personaKey: string,
    force: boolean,
    scenarioKey?: string,
  ): Promise<{ echoId: string; taskId: string | null }> {
    const resolvedScenarioKey = scenarioKey ?? subjectType
    this.requireScenario(resolvedScenarioKey)
    const existing = await this.repository.findOne({
      scenarioKey: resolvedScenarioKey,
      subjectType,
      subjectId,
      personaKey,
    })
    if (
      existing &&
      (existing.status === 'pending' || existing.status === 'generating') &&
      !force
    ) {
      throw createAppException(AppErrorCode.AI_ECHO_REGENERATE_IN_PROGRESS, {
        echoId: existing.id,
      })
    }
    if (existing && force) {
      await this.repository.update(existing.id, { status: 'archived' })
    }
    const result = await this.enqueueOne(
      resolvedScenarioKey,
      subjectType,
      subjectId,
      personaKey,
    )
    return { echoId: result.echoId, taskId: result.taskId }
  }

  private async enqueueOne(
    scenarioKey: string,
    subjectType: string,
    subjectId: string,
    personaKey: string,
  ): Promise<DispatchResult> {
    const quotaOk = await this.consumeQuota()
    const row = await this.repository.create({
      scenarioKey,
      subjectType,
      subjectId,
      personaKey,
      status: quotaOk.allowed ? 'pending' : 'failed',
      metadata: quotaOk.allowed
        ? {}
        : {
            errorCode: AppErrorCode.AI_ECHO_DAILY_QUOTA_EXCEEDED,
            quota: quotaOk.quota,
            used: quotaOk.used,
          },
    })
    if (!quotaOk.allowed) {
      this.logger.warn(
        `Echo daily quota exceeded: used=${quotaOk.used} quota=${quotaOk.quota}`,
      )
      return { echoId: row.id, taskId: null, status: row.status }
    }
    try {
      const payload: EchoGenerateTaskPayload = { echoId: row.id }
      const { taskId } = await this.aiTaskService.crud.createTask({
        type: AITaskType.EchoGenerate,
        payload: payload as unknown as Record<string, unknown>,
        dedupKey: `echo:generate:${row.id}`,
      })
      await this.repository.update(row.id, {
        metadata: { ...row.metadata, taskId },
      })
      return { echoId: row.id, taskId, status: row.status }
    } catch (error) {
      this.logger.error(
        `Failed to enqueue echo task: echoId=${row.id} error=${(error as Error).message}`,
      )
      await this.repository.update(row.id, {
        status: 'failed',
        metadata: {
          ...row.metadata,
          errorCode: AppErrorCode.AI_ECHO_GENERATION_FAILED,
          upstreamMessage: (error as Error).message?.slice(
            0,
            ECHO_DEFAULTS.upstreamMessageMaxLen,
          ),
        },
      })
      return { echoId: row.id, taskId: null, status: 'failed' }
    }
  }

  private async consumeQuota(): Promise<{
    allowed: boolean
    used: number
    quota: number
  }> {
    let quota: number = ECHO_DEFAULTS.dailyQuota
    try {
      const aiConfig = await this.configsService.get('ai')
      if (typeof aiConfig?.echoDailyQuota === 'number') {
        quota = aiConfig.echoDailyQuota
      }
    } catch {
      // fall through with default
    }
    if (quota <= 0) {
      return { allowed: true, used: 0, quota: 0 }
    }
    const key = `${ECHO_QUOTA_REDIS_KEY_PREFIX}${this.dayKey()}`
    try {
      const redis = this.redisService.getClient()
      const used = await redis.incr(key)
      if (used === 1) {
        await redis.expire(key, 60 * 60 * 26)
      }
      return { allowed: used <= quota, used, quota }
    } catch (error) {
      this.logger.warn(
        `Echo quota redis unavailable; allowing request: ${(error as Error).message}`,
      )
      return { allowed: true, used: 0, quota }
    }
  }

  private dayKey(): string {
    return new Date().toISOString().slice(0, 10)
  }

  async listPublicBySubject(
    scenarioKey: string,
    subjectType: string,
    subjectId: string,
    personaKey?: string,
  ): Promise<AiEcho[]> {
    const rows = await this.repository.findAllBySubject(
      scenarioKey,
      subjectType,
      subjectId,
    )
    return rows.filter(
      (row) =>
        (row.status === 'ready' || row.status === 'edited') &&
        (!personaKey || row.personaKey === personaKey),
    )
  }

  async getById(id: string): Promise<AiEcho> {
    const row = await this.repository.findById(id)
    if (!row) {
      throw createAppException(AppErrorCode.AI_ECHO_NOT_FOUND, { id })
    }
    return row
  }

  async edit(id: string, content: string, actorId: string): Promise<AiEcho> {
    await this.getById(id)
    const updated = await this.repository.update(id, {
      status: 'edited',
      content,
      editedAt: new Date(),
      editedBy: actorId,
    })
    if (!updated) {
      throw createAppException(AppErrorCode.AI_ECHO_NOT_FOUND, { id })
    }
    return updated
  }

  async softDelete(id: string): Promise<void> {
    const updated = await this.repository.setStatus(id, 'archived')
    if (!updated) {
      throw createAppException(AppErrorCode.AI_ECHO_NOT_FOUND, { id })
    }
  }

  async adminList(query: AdminListEchoQueryInput) {
    return this.repository.findAdmin(
      {
        scenarioKey: query.scenarioKey,
        status: query.status,
        personaKey: query.personaKey,
        subjectType: query.subjectType,
      },
      query.page,
      query.size,
    )
  }

  async handleSubjectDeleted(
    subjectType: string,
    subjectId: string,
  ): Promise<void> {
    const scenario = this.registry.list().find((s) => s.key === subjectType)
    const scenarioKey = scenario?.key ?? subjectType
    const rows = await this.repository.findAllBySubject(
      scenarioKey,
      subjectType,
      subjectId,
    )
    for (const row of rows) {
      if (row.status === 'pending' || row.status === 'generating') {
        await this.repository.update(row.id, {
          status: 'failed',
          metadata: { ...row.metadata, aborted: true },
        })
      } else if (row.status === 'ready' || row.status === 'edited') {
        await this.repository.update(row.id, { status: 'archived' })
      }
    }
  }
}
