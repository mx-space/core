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
import { createMockAiRuntime } from '@/mock/processors/ai-runtime.mock'
import { AppErrorCode } from '~/common/errors'
import { AppException } from '~/common/errors/exception.types'
import * as schema from '~/database/schema'
import { aiEchoes } from '~/database/schema'
import { AiEchoRepository } from '~/modules/ai/ai-echo/ai-echo.repository'
import { AiEchoService } from '~/modules/ai/ai-echo/ai-echo.service'
import { EchoScenarioRegistry } from '~/modules/ai/ai-echo/echo-scenario.registry'
import type { EchoScenario } from '~/modules/ai/ai-echo/scenario.types'
import { EchoGenerateTaskProcessor } from '~/modules/ai/ai-echo/tasks/echo-generate.processor'
import { SnowflakeService } from '~/shared/id/snowflake.service'

type Drizzle = NodePgDatabase<typeof schema>

const taskContextStub = () => ({
  taskId: 'task',
  signal: new AbortController().signal,
  updateProgress: vi.fn(async () => {}),
  incrementTokens: vi.fn(async () => {}),
  appendLog: vi.fn(async () => {}),
  setResult: vi.fn(async () => {}),
  setStatus: vi.fn(),
  isAborted: () => false,
})

const subjectStore = new Map<string, { id: string; content: string }>()

const recentlyScenario = (): EchoScenario => ({
  key: 'recently',
  defaultPersonas: ['inner-self', 'passerby'],
  emitOnReady: 'RECENTLY_ECHO_LANDED' as any,
  async loadSubject(id: string) {
    return subjectStore.get(id) ?? null
  },
  extractRetrievalQuery(s: any) {
    return s.content ?? null
  },
  buildPrompt() {
    return [
      { role: 'system' as const, content: 'sys' },
      { role: 'user' as const, content: 'user' },
    ]
  },
})

const hypotheticalScenario: EchoScenario = {
  key: 'comment',
  defaultPersonas: ['passerby'],
  async loadSubject(id: string) {
    return { id, content: 'hello from comment' }
  },
  extractRetrievalQuery() {
    return null
  },
  buildPrompt() {
    return [
      { role: 'system' as const, content: 'sys' },
      { role: 'user' as const, content: 'user' },
    ]
  },
}

interface Harness {
  service: AiEchoService
  repo: AiEchoRepository
  processor: EchoGenerateTaskProcessor
  runtime: ReturnType<typeof createMockAiRuntime>
  eventEmitterMock: {
    emit: ReturnType<typeof vi.fn>
    on: ReturnType<typeof vi.fn>
  }
  emittedEvents: Array<{ event: string; data: any }>
  registry: EchoScenarioRegistry
  taskCalls: any[]
}

const buildHarness = (
  db: Drizzle,
  opts: {
    extraScenarios?: EchoScenario[]
    quota?: number
    runtimeBehavior?: Parameters<typeof createMockAiRuntime>[0]
  } = {},
): Harness => {
  const repo = new AiEchoRepository(db as any, new SnowflakeService())
  const emittedEvents: Array<{ event: string; data: any }> = []
  const eventEmitterMock = {
    emit: vi.fn(async (event: string, data: any) => {
      emittedEvents.push({ event, data })
    }),
    on: vi.fn(),
  }
  const taskCalls: any[] = []
  const taskService = {
    crud: {
      createTask: vi.fn(async (input: any) => {
        taskCalls.push(input)
        return { taskId: 'task-' + taskCalls.length, created: true }
      }),
    },
  }
  const configsService = {
    get: vi.fn(async () => ({
      enableEcho: true,
      enableAutoGenerateEchoOnCreate: true,
      echoDailyQuota: opts.quota ?? 200,
    })),
  }
  let counter = 0
  const redisService = {
    getClient: () => ({
      incr: vi.fn(async () => {
        counter += 1
        return counter
      }),
      expire: vi.fn(async () => 1),
    }),
  }
  const registry = new EchoScenarioRegistry()
  registry.register(recentlyScenario())
  for (const s of opts.extraScenarios ?? []) registry.register(s)

  const service = new AiEchoService(
    repo,
    taskService as any,
    eventEmitterMock as any,
    configsService as any,
    redisService as any,
    registry,
  )

  const runtime = createMockAiRuntime({
    modelId: 'mock-echo-model',
    behavior: opts.runtimeBehavior?.behavior ?? {
      kind: 'text',
      text: 'mock echo content',
    },
  })
  const aiService = {
    getEchoModel: vi.fn(async () => runtime.runtime),
  }
  const aiEmbeddingsService = { search: vi.fn(async () => []) }
  const aiMemoryService = { recall: vi.fn(async () => []) }
  const aiPersonaService = {
    getProfileOrNull: vi.fn(async () => null),
    pickExemplars: vi.fn(async () => []),
  }
  const processor = new EchoGenerateTaskProcessor(
    { registerHandler: vi.fn() } as any,
    repo,
    aiService as any,
    aiEmbeddingsService as any,
    aiMemoryService as any,
    aiPersonaService as any,
    configsService as any,
    eventEmitterMock as any,
    registry,
  )

  return {
    service,
    repo,
    processor,
    runtime,
    eventEmitterMock,
    emittedEvents,
    registry,
    taskCalls,
  }
}

describe('AiEchoService integration (pg testcontainer)', () => {
  let pool: Pool
  let db: Drizzle

  beforeAll(async () => {
    const container = await startPgTestContainer()
    pool = new Pool({ connectionString: container.getConnectionUri(), max: 4 })
    db = drizzle(pool, { schema, casing: 'snake_case' })
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector')
  })

  afterAll(async () => {
    await pool?.end()
  })

  beforeEach(async () => {
    await pool.query('DELETE FROM ai_echoes')
    subjectStore.clear()
  })

  it('dispatch creates one row per persona, processor brings each to ready and emits RECENTLY_ECHO_LANDED', async () => {
    const harness = buildHarness(db)
    subjectStore.set('100001', { id: '100001', content: 'a thought' })

    const dispatched = await harness.service.dispatch(
      'recently',
      'recently',
      '100001',
    )
    expect(dispatched).toHaveLength(2)
    expect(harness.taskCalls).toHaveLength(2)

    for (const r of dispatched) {
      await harness.processor.handle(
        { echoId: r.echoId },
        taskContextStub() as any,
      )
    }

    const rows = await db.select().from(aiEchoes)
    expect(rows).toHaveLength(2)
    for (const r of rows) {
      expect(r.status).toBe('ready')
      expect(r.content).toBe('mock echo content')
      expect(r.model).toBe('mock-echo-model')
    }

    const landed = harness.emittedEvents.filter(
      (e) => e.event === 'RECENTLY_ECHO_LANDED',
    )
    expect(landed).toHaveLength(2)
  })

  it('replay: second handle invocation for the same echoId is a no-op', async () => {
    const harness = buildHarness(db)
    subjectStore.set('100002', { id: '100002', content: 'replay subject' })
    const [first] = await harness.service.dispatch(
      'recently',
      'recently',
      '100002',
    )
    await harness.processor.handle(
      { echoId: first.echoId },
      taskContextStub() as any,
    )
    const beforeRowsSql = await db.select().from(aiEchoes)
    const beforeRow = beforeRowsSql.find((r) => r.id === first.echoId)!
    const beforeUpdatedAt = beforeRow.updatedAt?.getTime()

    await new Promise((r) => setTimeout(r, 10))
    await harness.processor.handle(
      { echoId: first.echoId },
      taskContextStub() as any,
    )

    const afterRowsSql = await db.select().from(aiEchoes)
    const afterRow = afterRowsSql.find((r) => r.id === first.echoId)!
    expect(afterRow.status).toBe('ready')
    expect(afterRow.updatedAt?.getTime()).toBe(beforeUpdatedAt)
  })

  it('subject delete mid-flight marks in-flight rows failed/aborted; next task wake is a no-op', async () => {
    const harness = buildHarness(db)
    subjectStore.set('100003', {
      id: '100003',
      content: 'deleted before generate',
    })
    const [first] = await harness.service.dispatch(
      'recently',
      'recently',
      '100003',
    )

    await harness.service.handleSubjectDeleted('recently', '100003')

    const rowsAfterDelete = await db.select().from(aiEchoes)
    const target = rowsAfterDelete.find((r) => r.id === first.echoId)!
    expect(target.status).toBe('failed')
    expect((target.metadata as any).aborted).toBe(true)

    await harness.processor.handle(
      { echoId: first.echoId },
      taskContextStub() as any,
    )
    const rowsAfterReplay = await db.select().from(aiEchoes)
    const targetAfter = rowsAfterReplay.find((r) => r.id === first.echoId)!
    expect(targetAfter.status).toBe('failed')
  })

  it('regenerate with force archives old row and creates fresh', async () => {
    const harness = buildHarness(db)
    subjectStore.set('100004', { id: '100004', content: 'regen subject' })

    const [first] = await harness.service.dispatch(
      'recently',
      'recently',
      '100004',
    )
    await harness.processor.handle(
      { echoId: first.echoId },
      taskContextStub() as any,
    )

    const result = await harness.service.regenerate(
      'recently',
      '100004',
      'inner-self',
      true,
    )
    expect(result.echoId).not.toBe(first.echoId)

    const rows = await db.select().from(aiEchoes)
    const old = rows.find((r) => r.id === first.echoId)!
    expect(old.status).toBe('archived')
    const fresh = rows.find((r) => r.id === result.echoId)!
    expect(fresh.status).toBe('pending')
  })

  it('edit returns status="edited" with editedBy populated', async () => {
    const harness = buildHarness(db)
    subjectStore.set('100005', { id: '100005', content: 'editme' })
    const [first] = await harness.service.dispatch(
      'recently',
      'recently',
      '100005',
    )
    await harness.processor.handle(
      { echoId: first.echoId },
      taskContextStub() as any,
    )

    const editor = '7000000000000000001'
    const edited = await harness.service.edit(first.echoId, 'rewritten', editor)
    expect(edited.status).toBe('edited')
    expect(edited.content).toBe('rewritten')
    expect(edited.editedBy).toBe(editor)
    expect(edited.editedAt).not.toBeNull()
  })

  it('runtime throws -> status=failed, errorCode=AI_ECHO_GENERATION_FAILED', async () => {
    const harness = buildHarness(db, {
      runtimeBehavior: {
        behavior: { kind: 'throw', error: new Error('rate limited') },
      },
    })
    subjectStore.set('100006', { id: '100006', content: 'fail me' })
    const [first] = await harness.service.dispatch(
      'recently',
      'recently',
      '100006',
    )
    await expect(
      harness.processor.handle(
        { echoId: first.echoId },
        taskContextStub() as any,
      ),
    ).rejects.toThrow()

    const rows = await db.select().from(aiEchoes)
    const target = rows.find((r) => r.id === first.echoId)!
    expect(target.status).toBe('failed')
    expect((target.metadata as any).errorCode).toBe(
      AppErrorCode.AI_ECHO_GENERATION_FAILED,
    )
    expect((target.metadata as any).upstreamMessage).toContain('rate limited')
  })

  it('echoDailyQuota=1 -> second enqueue terminates with AI_ECHO_DAILY_QUOTA_EXCEEDED', async () => {
    const harness = buildHarness(db, { quota: 1 })
    subjectStore.set('100007', { id: '100007', content: 'quota me' })
    await harness.service.dispatch('recently', 'recently', '100007')
    const rows = await db.select().from(aiEchoes)
    expect(rows).toHaveLength(2)
    const failed = rows.find((r) => r.status === 'failed')!
    expect((failed.metadata as any).errorCode).toBe(
      AppErrorCode.AI_ECHO_DAILY_QUOTA_EXCEEDED,
    )
  })

  it('hypothetical extra ECHO_SCENARIO consumed by engine with zero engine changes', async () => {
    const harness = buildHarness(db, { extraScenarios: [hypotheticalScenario] })
    const result = await harness.service.dispatch(
      'comment',
      'comment',
      '700001',
    )
    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('pending')
    const rows = await db.select().from(aiEchoes)
    expect(rows[0].scenarioKey).toBe('comment')
    expect(rows[0].personaKey).toBe('passerby')
  })

  it('regenerate (force=false) on pending row throws AI_ECHO_REGENERATE_IN_PROGRESS', async () => {
    const harness = buildHarness(db)
    subjectStore.set('100008', { id: '100008', content: 'pending row' })
    await harness.service.dispatch('recently', 'recently', '100008')
    await expect(
      harness.service.regenerate('recently', '100008', 'inner-self', false),
    ).rejects.toBeInstanceOf(AppException)
  })
})
