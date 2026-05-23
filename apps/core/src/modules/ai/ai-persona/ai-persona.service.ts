import { Injectable, Logger } from '@nestjs/common'

import { AppErrorCode, createAppException } from '~/common/errors'
import { RedisService } from '~/processors/redis/redis.service'

import { ConfigsService } from '../../configs/configs.service'
import { AiTaskService } from '../ai-task/ai-task.service'
import {
  AITaskType,
  type PersonaDistillTaskPayload,
} from '../ai-task/ai-task.types'
import { PERSONA_DISTILL_LOCK_KEY_PREFIX } from './ai-persona.constants'
import { PersonaProfileRepository } from './ai-persona.repository'
import type {
  ExemplarPassage,
  PersonaDefinitionWithStatus,
  PersonaProfile,
} from './ai-persona.types'
import { ExemplarSelector } from './exemplar-selector'
import {
  getPersonaDefinition,
  listPersonas,
  tryGetPersonaDefinition,
} from './persona-registry'

@Injectable()
export class AiPersonaService {
  private readonly logger = new Logger(AiPersonaService.name)

  constructor(
    private readonly profileRepo: PersonaProfileRepository,
    private readonly aiTaskService: AiTaskService,
    private readonly redisService: RedisService,
    private readonly configsService: ConfigsService,
    private readonly exemplarSelector: ExemplarSelector,
  ) {}

  async listPersonasWithStatus(): Promise<PersonaDefinitionWithStatus[]> {
    const personas = listPersonas()
    const profileKeys = await this.profileRepo.listKeysWithProfiles()
    return personas.map((p) => ({
      ...p,
      hasProfile: p.needsProfile && profileKeys.has(p.key),
    }))
  }

  async getProfile(personaKey: string): Promise<PersonaProfile> {
    const def = tryGetPersonaDefinition(personaKey)
    if (!def || !def.needsProfile) {
      throw createAppException(AppErrorCode.AI_PERSONA_PROFILE_NOT_FOUND, {
        key: personaKey,
      })
    }
    const row = await this.profileRepo.findByKey(personaKey)
    if (!row) {
      throw createAppException(AppErrorCode.AI_PERSONA_PROFILE_NOT_FOUND, {
        key: personaKey,
      })
    }
    return row
  }

  async getProfileOrNull(personaKey: string): Promise<PersonaProfile | null> {
    const def = tryGetPersonaDefinition(personaKey)
    if (!def || !def.needsProfile) return null
    return this.profileRepo.findByKey(personaKey)
  }

  async refresh(personaKey: string): Promise<{ taskId: string }> {
    const def = getPersonaDefinition(personaKey)
    if (!def.needsProfile) {
      throw createAppException(AppErrorCode.AI_PERSONA_NOT_DISTILLABLE, {
        key: personaKey,
      })
    }

    await this.assertDistillModelConfigured()

    const lockKey = `${PERSONA_DISTILL_LOCK_KEY_PREFIX}${personaKey}`
    const redis = this.redisService.getClient()
    const exists = await redis.exists(lockKey)
    if (exists) {
      throw createAppException(AppErrorCode.AI_PERSONA_REFRESH_IN_PROGRESS, {
        key: personaKey,
      })
    }

    const payload: PersonaDistillTaskPayload = { personaKey }
    const { taskId } = await this.aiTaskService.crud.createTask({
      type: AITaskType.PersonaDistill,
      payload: payload as unknown as Record<string, unknown>,
      dedupKey: `persona:distill:${personaKey}`,
    })

    this.logger.log(
      `Persona distill task enqueued: key=${personaKey} taskId=${taskId}`,
    )

    return { taskId }
  }

  async pickExemplars(
    personaKey: string,
    opts: {
      count: number
      lengthMin?: number
      lengthMax?: number
      rng?: () => number
      bypassCache?: boolean
    },
  ): Promise<ExemplarPassage[]> {
    const def = getPersonaDefinition(personaKey)
    if (!def.usesExemplars) return []
    return this.exemplarSelector.pickExemplars(personaKey, opts)
  }

  private async assertDistillModelConfigured(): Promise<void> {
    const aiConfig = await this.configsService.get('ai')
    const personaModel = aiConfig?.personaDistillModel
    const echoModel = aiConfig?.echoModel
    const hasProviders = !!aiConfig?.providers?.some((p) => p.enabled)
    if (!hasProviders || (!personaModel && !echoModel)) {
      throw createAppException(
        AppErrorCode.AI_PERSONA_DISTILL_MODEL_NOT_CONFIGURED,
      )
    }
  }
}
