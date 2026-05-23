import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { startPgTestContainer } from '@/helper/pg-testcontainer'
import { redisHelper } from '@/helper/redis-mock.helper'
import { createMockAiRuntime } from '@/mock/processors/ai-runtime.mock'
import { AppErrorCode } from '~/common/errors'
import { AppException } from '~/common/errors/exception.types'
import { BusinessEvents } from '~/constants/business-event.constant'
import * as schema from '~/database/schema'
import { notes, pages, personaProfiles } from '~/database/schema'
import { PERSONA_DISTILL_LOCK_KEY_PREFIX } from '~/modules/ai/ai-persona/ai-persona.constants'
import { PersonaProfileRepository } from '~/modules/ai/ai-persona/ai-persona.repository'
import { AiPersonaService } from '~/modules/ai/ai-persona/ai-persona.service'
import { ExemplarSelector } from '~/modules/ai/ai-persona/exemplar-selector'
import { PersonaDistillProcessor } from '~/modules/ai/ai-persona/tasks/persona-distill.processor'
import { AITaskType } from '~/modules/ai/ai-task/ai-task.types'
import { SnowflakeService } from '~/shared/id/snowflake.service'

type Drizzle = NodePgDatabase<typeof schema>

const seedCorpus = async (db: Drizzle, snowflake: SnowflakeService) => {
  await db.insert(notes).values({
    id: snowflake.nextId(),
    title: 'A Note',
    text: 'Reading again about solitude.\n\nThe author writes with quiet precision. I noticed how a single careful sentence can dismantle a whole afternoon of restlessness.',
    contentFormat: 'markdown',
    isPublished: true,
  } as any)
  await db.insert(pages).values({
    id: snowflake.nextId(),
    title: 'About',
    slug: `about-${Date.now()}`,
    text: 'I have been writing here for years.\n\nThis page collects the slow accumulations of a life spent paying attention to small things — drafts, half-thoughts, partial sketches.',
    contentFormat: 'markdown',
  } as any)
}

const DISTILL_JSON = JSON.stringify({
  profile:
    'The author writes with quiet precision. They tend to anchor abstract reflections in concrete sensory details and prefer short, declarative sentences with careful pauses.',
  profile_summary:
    'A precise, quiet voice that anchors abstractions in concrete details.',
  metadata: {
    tone_tags: ['quiet', 'precise'],
    recurring_themes: ['attention', 'solitude'],
    signature_phrases: ['quiet precision'],
  },
})

describe('ai-persona integration (pg + redis)', () => {
  let pool: Pool
  let db: Drizzle
  let snowflake: SnowflakeService
  let redisService: any
  let mockRuntime: ReturnType<typeof createMockAiRuntime>
  let service: AiPersonaService
  let processor: PersonaDistillProcessor
  let profileRepo: PersonaProfileRepository
  let exemplarSelector: ExemplarSelector
  let aiTaskService: any
  let configsService: any
  let eventManager: any
  let enqueuedTasks: Array<{ type: string; payload: any; dedupKey?: string }>

  beforeAll(async () => {
    const container = await startPgTestContainer()
    pool = new Pool({
      connectionString: container.getConnectionUri(),
      max: 4,
    })
    db = drizzle(pool, { schema, casing: 'snake_case' })
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector')

    snowflake = new SnowflakeService()
    const helper = await redisHelper
    redisService = {
      getClient: () => helper.RedisService.getClient(),
    }
    mockRuntime = createMockAiRuntime({
      modelId: 'mock-distill',
      behavior: { kind: 'text', text: DISTILL_JSON },
    })

    profileRepo = new PersonaProfileRepository(db as any, snowflake)
    exemplarSelector = new ExemplarSelector(db as any, redisService, {} as any)

    configsService = {
      get: vi.fn(async (key: string) => {
        if (key === 'ai') {
          return {
            providers: [{ id: 'p', enabled: true }],
            personaDistillModel: { providerId: 'p', model: 'm' },
            echoModel: undefined,
            aiPersona: {
              distillSampleMaxTokens: 8000,
              exemplarsLengthMin: 50,
              exemplarsLengthMax: 600,
              exemplarsCandidateCacheTtlSec: 60,
            },
          }
        }
        return {}
      }),
    }
    enqueuedTasks = []
    aiTaskService = {
      crud: {
        createTask: vi.fn(async (opts: any) => {
          enqueuedTasks.push(opts)
          return { taskId: `task-${enqueuedTasks.length}`, created: true }
        }),
      },
    }
    eventManager = {
      emit: vi.fn(async () => {}),
      broadcast: vi.fn(async () => {}),
    }

    service = new AiPersonaService(
      profileRepo,
      aiTaskService,
      redisService,
      configsService,
      exemplarSelector,
    )

    processor = new PersonaDistillProcessor(
      db as any,
      { registerHandler: vi.fn() } as any,
      {
        async getPersonaDistillModel() {
          return mockRuntime.runtime
        },
      } as any,
      configsService,
      profileRepo,
      redisService,
      eventManager,
    )
  })

  afterAll(async () => {
    await pool?.end()
  })

  beforeEach(async () => {
    await pool.query('DELETE FROM persona_profiles')
    await pool.query('DELETE FROM notes')
    await pool.query('DELETE FROM pages')
    const redis = redisService.getClient()
    const keys = await redis.keys(`${PERSONA_DISTILL_LOCK_KEY_PREFIX}*`)
    if (keys.length) await redis.del(...keys)
    enqueuedTasks.length = 0
    mockRuntime.reset()
    mockRuntime.setBehavior({ kind: 'text', text: DISTILL_JSON })
    eventManager.emit.mockClear()
  })

  it('refresh enqueues a PERSONA_DISTILL task', async () => {
    const { taskId } = await service.refresh('inner-self')
    expect(taskId).toBeTruthy()
    expect(enqueuedTasks).toHaveLength(1)
    expect(enqueuedTasks[0].type).toBe(AITaskType.PersonaDistill)
    expect(enqueuedTasks[0].payload).toMatchObject({
      personaKey: 'inner-self',
    })
  })

  it('persists a row and emits PERSONA_PROFILE_REFRESHED after processor runs', async () => {
    await seedCorpus(db, snowflake)
    const ctx = makeContext()
    await invokeProcessor(processor, ctx)
    const row = await profileRepo.findByKey('inner-self')
    expect(row).not.toBeNull()
    expect(row?.profile).toContain('quiet precision')
    expect(row?.profileSummary).toContain('precise, quiet voice')
    expect(row?.distillModel).toBe('mock-distill')
    expect(eventManager.emit).toHaveBeenCalledWith(
      BusinessEvents.PERSONA_PROFILE_REFRESHED,
      expect.objectContaining({ personaKey: 'inner-self' }),
    )
  })

  it('second concurrent refresh returns 409 when lock held', async () => {
    const redis = redisService.getClient()
    await redis.set(
      `${PERSONA_DISTILL_LOCK_KEY_PREFIX}inner-self`,
      '1',
      'EX',
      60,
    )
    try {
      await service.refresh('inner-self')
      expect.fail('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(AppException)
      expect((error as AppException).code).toBe(
        AppErrorCode.AI_PERSONA_REFRESH_IN_PROGRESS,
      )
    }
  })

  it('listPersonasWithStatus marks inner-self hasProfile=true after distill', async () => {
    await seedCorpus(db, snowflake)
    await invokeProcessor(processor, makeContext())
    const list = await service.listPersonasWithStatus()
    const inner = list.find((p) => p.key === 'inner-self')!
    const passerby = list.find((p) => p.key === 'passerby')!
    expect(inner.hasProfile).toBe(true)
    expect(passerby.hasProfile).toBe(false)
  })

  it('getProfile returns AI_PERSONA_PROFILE_NOT_FOUND for passerby', async () => {
    try {
      await service.getProfile('passerby')
      expect.fail('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(AppException)
      expect((error as AppException).code).toBe(
        AppErrorCode.AI_PERSONA_PROFILE_NOT_FOUND,
      )
    }
  })

  it('refresh fails with AI_PERSONA_DISTILL_MODEL_NOT_CONFIGURED when no model is set', async () => {
    configsService.get.mockResolvedValueOnce({
      providers: [{ id: 'p', enabled: true }],
      personaDistillModel: undefined,
      echoModel: undefined,
    })
    try {
      await service.refresh('inner-self')
      expect.fail('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(AppException)
      expect((error as AppException).code).toBe(
        AppErrorCode.AI_PERSONA_DISTILL_MODEL_NOT_CONFIGURED,
      )
    }
  })

  it('upsert updates an existing row in place', async () => {
    await seedCorpus(db, snowflake)
    await invokeProcessor(processor, makeContext())
    mockRuntime.setBehavior({
      kind: 'text',
      text: JSON.stringify({
        profile: 'Revised profile content.',
        profile_summary: 'Revised summary.',
        metadata: {
          tone_tags: ['revised'],
          recurring_themes: [],
          signature_phrases: [],
        },
      }),
    })
    await invokeProcessor(processor, makeContext())
    const rows = await db
      .select({ id: personaProfiles.id, profile: personaProfiles.profile })
      .from(personaProfiles)
    expect(rows).toHaveLength(1)
    expect(rows[0].profile).toBe('Revised profile content.')
  })
})

const makeContext = () => ({
  taskId: 'test-task',
  signal: new AbortController().signal,
  appendLog: vi.fn(async () => {}),
  updateProgress: vi.fn(async () => {}),
  incrementTokens: vi.fn(async () => {}),
  setResult: vi.fn(async () => {}),
  setStatus: vi.fn(),
  isAborted: () => false,
})

const invokeProcessor = async (
  proc: PersonaDistillProcessor,
  ctx: ReturnType<typeof makeContext>,
) => {
  const handle = (proc as any).handle.bind(proc)
  await handle({ personaKey: 'inner-self' }, ctx)
}
