import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppErrorCode } from '~/common/errors'
import { AppException } from '~/common/errors/exception.types'
import { AiEchoService } from '~/modules/ai/ai-echo/ai-echo.service'
import { EchoScenarioRegistry } from '~/modules/ai/ai-echo/echo-scenario.registry'
import type { EchoScenario } from '~/modules/ai/ai-echo/scenario.types'

const fakeRepoFactory = () => {
  const rows: any[] = []
  let nextId = 1
  return {
    rows,
    findById: vi.fn(
      async (id: string) => rows.find((r) => r.id === id) ?? null,
    ),
    findOne: vi.fn(async (criteria: any) => {
      return (
        rows.find(
          (r) =>
            r.scenarioKey === criteria.scenarioKey &&
            r.subjectType === criteria.subjectType &&
            r.subjectId === criteria.subjectId &&
            r.personaKey === criteria.personaKey,
        ) ?? null
      )
    }),
    findAllBySubject: vi.fn(
      async (scenarioKey: string, subjectType: string, subjectId: string) =>
        rows.filter(
          (r) =>
            r.scenarioKey === scenarioKey &&
            r.subjectType === subjectType &&
            r.subjectId === subjectId,
        ),
    ),
    findAdmin: vi.fn(async () => ({
      data: rows.slice(),
      pagination: {
        currentPage: 1,
        totalPage: 1,
        total: rows.length,
        size: 20,
        hasNextPage: false,
        hasPrevPage: false,
      },
    })),
    create: vi.fn(async (input: any) => {
      const row = {
        id: String(nextId++),
        ...input,
        metadata: input.metadata ?? {},
        content: null,
        model: null,
        generatedAt: null,
        editedAt: null,
        editedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      rows.push(row)
      return row
    }),
    update: vi.fn(async (id: string, patch: any) => {
      const row = rows.find((r) => r.id === id)
      if (!row) return null
      Object.assign(row, patch)
      return row
    }),
    setStatus: vi.fn(async function (this: any, id: string, status: string) {
      return this.update(id, { status })
    }),
  }
}

const fakeTaskService = () => ({
  crud: {
    createTask: vi.fn(async () => ({ taskId: 'task-1', created: true })),
  },
})

const fakeEventManager = () => ({
  on: vi.fn(),
  emit: vi.fn(),
})

const fakeConfigsService = (overrides: any = {}) => ({
  get: vi.fn(async () => ({
    enableEcho: true,
    enableAutoGenerateEchoOnCreate: true,
    echoDailyQuota: 200,
    ...overrides,
  })),
})

const fakeRedis = (initial = 0) => {
  let counter = initial
  return {
    getClient: () => ({
      incr: vi.fn(async () => {
        counter += 1
        return counter
      }),
      expire: vi.fn(async () => 1),
    }),
  }
}

const registryWith = (scenarios: EchoScenario[]) => {
  const registry = new EchoScenarioRegistry()
  scenarios.forEach((s) => registry.register(s))
  return registry
}

const scenarioStub: EchoScenario = {
  key: 'recently',
  defaultPersonas: ['inner-self', 'passerby'],
  async loadSubject() {
    return null
  },
  extractRetrievalQuery() {
    return null
  },
  buildPrompt() {
    return []
  },
}

describe('AiEchoService', () => {
  let repo: ReturnType<typeof fakeRepoFactory>
  let task: ReturnType<typeof fakeTaskService>
  let event: ReturnType<typeof fakeEventManager>
  let config: ReturnType<typeof fakeConfigsService>
  let redis: ReturnType<typeof fakeRedis>

  beforeEach(() => {
    repo = fakeRepoFactory()
    task = fakeTaskService()
    event = fakeEventManager()
    config = fakeConfigsService()
    redis = fakeRedis()
  })

  it('requireScenario throws AI_ECHO_SCENARIO_NOT_REGISTERED on unknown key', () => {
    const service = new AiEchoService(
      repo as any,
      task as any,
      event as any,
      config as any,
      redis as any,
      registryWith([]),
    )
    expect(() => service.requireScenario('unknown')).toThrow(AppException)
    try {
      service.requireScenario('unknown')
    } catch (error) {
      expect((error as AppException).code).toBe(
        AppErrorCode.AI_ECHO_SCENARIO_NOT_REGISTERED,
      )
    }
  })

  it('dispatch creates one row per persona and enqueues tasks', async () => {
    const service = new AiEchoService(
      repo as any,
      task as any,
      event as any,
      config as any,
      redis as any,
      registryWith([scenarioStub]),
    )
    const results = await service.dispatch('recently', 'recently', '1001')
    expect(results).toHaveLength(2)
    expect(repo.rows).toHaveLength(2)
    expect(task.crud.createTask).toHaveBeenCalledTimes(2)
    for (const row of repo.rows) {
      expect(row.status).toBe('pending')
      expect(row.metadata.taskId).toBe('task-1')
    }
  })

  it('enforces echoDailyQuota — second enqueue marked failed with AI_ECHO_DAILY_QUOTA_EXCEEDED', async () => {
    config = fakeConfigsService({ echoDailyQuota: 1 })
    const service = new AiEchoService(
      repo as any,
      task as any,
      event as any,
      config as any,
      redis as any,
      registryWith([scenarioStub]),
    )
    await service.dispatch('recently', 'recently', '1001')
    expect(repo.rows[0].status).toBe('pending')
    expect(repo.rows[1].status).toBe('failed')
    expect(repo.rows[1].metadata.errorCode).toBe(
      AppErrorCode.AI_ECHO_DAILY_QUOTA_EXCEEDED,
    )
    expect(task.crud.createTask).toHaveBeenCalledTimes(1)
  })

  it('regenerate without force throws when in-flight row exists', async () => {
    const service = new AiEchoService(
      repo as any,
      task as any,
      event as any,
      config as any,
      redis as any,
      registryWith([scenarioStub]),
    )
    await repo.create({
      scenarioKey: 'recently',
      subjectType: 'recently',
      subjectId: '2002',
      personaKey: 'inner-self',
      status: 'pending',
    })
    await expect(
      service.regenerate('recently', '2002', 'inner-self', false),
    ).rejects.toBeInstanceOf(AppException)
  })

  it('regenerate with force archives old row and creates new', async () => {
    const service = new AiEchoService(
      repo as any,
      task as any,
      event as any,
      config as any,
      redis as any,
      registryWith([scenarioStub]),
    )
    const existing = await repo.create({
      scenarioKey: 'recently',
      subjectType: 'recently',
      subjectId: '3003',
      personaKey: 'inner-self',
      status: 'ready',
    })
    const result = await service.regenerate(
      'recently',
      '3003',
      'inner-self',
      true,
    )
    expect(repo.rows.find((r) => r.id === existing.id)?.status).toBe('archived')
    expect(result.echoId).not.toBe(existing.id)
  })
})
