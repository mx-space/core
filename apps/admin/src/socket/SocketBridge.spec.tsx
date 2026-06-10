import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AITask, AITaskLog, AITasksResponse } from '~/api/tasks'
import { AITaskStatus, AITaskType } from '~/api/tasks'
import { adminQueryKeys } from '~/query/keys'

import { handleTaskUpdate } from './SocketBridge'
import type { TaskUpdatePayload, TaskUpdateStreamFrame } from './types'

// Spec 2 step-27 — SocketBridge TASK_UPDATE phase routing.
// Verifies each of the 8 phases routes through the right cache hooks:
//   created/started/progress/status/log/result/stream/deleted.

function makeTask(overrides: Partial<AITask> = {}): AITask {
  return {
    createdAt: 1_700_000_000_000,
    id: 'task-1',
    logs: [],
    payload: {},
    retryCount: 0,
    status: AITaskStatus.Pending,
    type: AITaskType.Summary,
    ...overrides,
  }
}

function makeListResponse(tasks: AITask[]): AITasksResponse {
  return { data: tasks, total: tasks.length }
}

const TASKS_PARAMS = {
  page: 1,
  size: 50,
  status: undefined,
  type: undefined,
}

let queryClient: QueryClient

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
})

afterEach(() => {
  queryClient.clear()
})

describe('handleTaskUpdate — phase routing', () => {
  it("'created' prepends full task to every list cache AND sets detail", () => {
    const seed = makeTask({ id: 'old' })
    queryClient.setQueryData(
      adminQueryKeys.tasks.tasks(TASKS_PARAMS),
      makeListResponse([seed]),
    )
    const fresh = makeTask({ id: 'new' })

    const payload: TaskUpdatePayload = {
      id: fresh.id,
      type: fresh.type,
      scope: 'ai',
      phase: 'created',
      patch: fresh,
    }
    handleTaskUpdate(queryClient, payload)

    const list = queryClient.getQueryData<AITasksResponse>(
      adminQueryKeys.tasks.tasks(TASKS_PARAMS),
    )
    expect(list?.data.map((t) => t.id)).toEqual(['new', 'old'])
    expect(list?.total).toBe(2)
    expect(
      queryClient.getQueryData<AITask>(adminQueryKeys.tasks.taskDetail('new')),
    ).toEqual(fresh)
  })

  it("'created' skips list caches whose filter params conflict with the payload", () => {
    const cronParams = { ...TASKS_PARAMS, scope: 'cron' }
    const enrichmentParams = { ...TASKS_PARAMS, scope: 'enrichment' }
    queryClient.setQueryData(
      adminQueryKeys.tasks.tasks(TASKS_PARAMS),
      makeListResponse([]),
    )
    queryClient.setQueryData(
      adminQueryKeys.tasks.tasks(cronParams),
      makeListResponse([]),
    )
    queryClient.setQueryData(
      adminQueryKeys.tasks.tasks(enrichmentParams),
      makeListResponse([]),
    )

    const fresh = makeTask({
      id: 'enrich-1',
      scope: 'enrichment',
      type: 'enrichment:probe' as AITaskType,
    })
    handleTaskUpdate(queryClient, {
      id: fresh.id,
      type: fresh.type,
      scope: 'enrichment',
      phase: 'created',
      patch: fresh,
    } satisfies TaskUpdatePayload)

    expect(
      queryClient.getQueryData<AITasksResponse>(
        adminQueryKeys.tasks.tasks(cronParams),
      )?.data,
    ).toEqual([])
    expect(
      queryClient
        .getQueryData<AITasksResponse>(adminQueryKeys.tasks.tasks(TASKS_PARAMS))
        ?.data.map((t) => t.id),
    ).toEqual(['enrich-1'])
    expect(
      queryClient
        .getQueryData<AITasksResponse>(
          adminQueryKeys.tasks.tasks(enrichmentParams),
        )
        ?.data.map((t) => t.id),
    ).toEqual(['enrich-1'])
  })

  it("'created' respects multi-status filter params on list caches", () => {
    const activeParams = { ...TASKS_PARAMS, status: ['pending', 'running'] }
    const completedParams = { ...TASKS_PARAMS, status: ['completed'] }
    queryClient.setQueryData(
      adminQueryKeys.tasks.tasks(activeParams),
      makeListResponse([]),
    )
    queryClient.setQueryData(
      adminQueryKeys.tasks.tasks(completedParams),
      makeListResponse([]),
    )

    const fresh = makeTask({ id: 'pending-1' })
    handleTaskUpdate(queryClient, {
      id: fresh.id,
      type: fresh.type,
      scope: 'ai',
      phase: 'created',
      patch: fresh,
    } satisfies TaskUpdatePayload)

    expect(
      queryClient
        .getQueryData<AITasksResponse>(adminQueryKeys.tasks.tasks(activeParams))
        ?.data.map((t) => t.id),
    ).toEqual(['pending-1'])
    expect(
      queryClient.getQueryData<AITasksResponse>(
        adminQueryKeys.tasks.tasks(completedParams),
      )?.data,
    ).toEqual([])
  })

  it("'deleted' removes row from every list cache AND removes detail cache", () => {
    const a = makeTask({ id: 'a' })
    const b = makeTask({ id: 'b' })
    queryClient.setQueryData(
      adminQueryKeys.tasks.tasks(TASKS_PARAMS),
      makeListResponse([a, b]),
    )
    queryClient.setQueryData(adminQueryKeys.tasks.taskDetail('b'), b)

    const payload: TaskUpdatePayload = {
      id: 'b',
      type: AITaskType.Summary,
      scope: 'ai',
      phase: 'deleted',
    }
    handleTaskUpdate(queryClient, payload)

    const list = queryClient.getQueryData<AITasksResponse>(
      adminQueryKeys.tasks.tasks(TASKS_PARAMS),
    )
    expect(list?.data.map((t) => t.id)).toEqual(['a'])
    expect(list?.total).toBe(1)
    expect(
      queryClient.getQueryData(adminQueryKeys.tasks.taskDetail('b')),
    ).toBeUndefined()
  })

  it("'deleted' also removes the row from the group's child-list cache", () => {
    const child = makeTask({ id: 'c', groupId: 'g' })
    queryClient.setQueryData(adminQueryKeys.tasks.tasksByGroup('g'), [child])

    const payload: TaskUpdatePayload = {
      id: 'c',
      type: AITaskType.Translation,
      scope: 'ai',
      phase: 'deleted',
      groupId: 'g',
    }
    handleTaskUpdate(queryClient, payload)

    expect(
      queryClient.getQueryData<AITask[]>(
        adminQueryKeys.tasks.tasksByGroup('g'),
      ),
    ).toEqual([])
  })

  it("'stream' dispatches a window CustomEvent and does NOT mutate cache", () => {
    const prev = makeTask({ id: 'sx', progress: 5 })
    queryClient.setQueryData(adminQueryKeys.tasks.taskDetail('sx'), prev)
    const list = makeListResponse([prev])
    queryClient.setQueryData(adminQueryKeys.tasks.tasks(TASKS_PARAMS), list)

    const streamFrame: TaskUpdateStreamFrame = {
      lang: 'ja',
      chunk: 'token',
    }
    const events: Array<{
      taskId: string
      groupId?: string
      stream?: TaskUpdateStreamFrame
    }> = []
    const listener = (event: Event) => {
      const detail = (event as CustomEvent).detail
      events.push(detail)
    }
    window.addEventListener('mx-admin:ai-task-stream', listener)
    try {
      const payload: TaskUpdatePayload = {
        id: 'sx',
        type: AITaskType.Translation,
        scope: 'ai',
        phase: 'stream',
        groupId: 'g1',
        stream: streamFrame,
      }
      handleTaskUpdate(queryClient, payload)
    } finally {
      window.removeEventListener('mx-admin:ai-task-stream', listener)
    }

    expect(events).toEqual([
      { taskId: 'sx', groupId: 'g1', stream: streamFrame },
    ])
    // Cache untouched
    expect(
      queryClient.getQueryData<AITask>(adminQueryKeys.tasks.taskDetail('sx')),
    ).toBe(prev)
    expect(
      queryClient.getQueryData<AITasksResponse>(
        adminQueryKeys.tasks.tasks(TASKS_PARAMS),
      ),
    ).toBe(list)
  })

  it("'progress' patches detail only (NOT list)", () => {
    const seed = makeTask({ id: 'p1', progress: 10 })
    queryClient.setQueryData(adminQueryKeys.tasks.taskDetail('p1'), seed)
    const listSeed = makeListResponse([seed])
    queryClient.setQueryData(adminQueryKeys.tasks.tasks(TASKS_PARAMS), listSeed)

    const payload: TaskUpdatePayload = {
      id: 'p1',
      type: AITaskType.Summary,
      scope: 'ai',
      phase: 'progress',
      patch: { progress: 75 },
    }
    handleTaskUpdate(queryClient, payload)

    expect(
      queryClient.getQueryData<AITask>(adminQueryKeys.tasks.taskDetail('p1'))
        ?.progress,
    ).toBe(75)
    // List cache reference stays — progress doesn't propagate to list.
    expect(
      queryClient.getQueryData<AITasksResponse>(
        adminQueryKeys.tasks.tasks(TASKS_PARAMS),
      ),
    ).toBe(listSeed)
  })

  it("'log' appends to detail logs only (NOT list)", () => {
    const seed = makeTask({ id: 'l1', logs: [] })
    queryClient.setQueryData(adminQueryKeys.tasks.taskDetail('l1'), seed)
    const listSeed = makeListResponse([seed])
    queryClient.setQueryData(adminQueryKeys.tasks.tasks(TASKS_PARAMS), listSeed)

    const log: AITaskLog = {
      level: 'info',
      message: 'hello',
      timestamp: 1,
    }
    const payload: TaskUpdatePayload = {
      id: 'l1',
      type: AITaskType.Summary,
      scope: 'ai',
      phase: 'log',
      log,
    }
    handleTaskUpdate(queryClient, payload)

    expect(
      queryClient.getQueryData<AITask>(adminQueryKeys.tasks.taskDetail('l1'))
        ?.logs,
    ).toEqual([log])
    expect(
      queryClient.getQueryData<AITasksResponse>(
        adminQueryKeys.tasks.tasks(TASKS_PARAMS),
      ),
    ).toBe(listSeed)
  })

  it("'started' patches BOTH detail and list", () => {
    const seed = makeTask({
      id: 's1',
      status: AITaskStatus.Pending,
    })
    queryClient.setQueryData(adminQueryKeys.tasks.taskDetail('s1'), seed)
    queryClient.setQueryData(
      adminQueryKeys.tasks.tasks(TASKS_PARAMS),
      makeListResponse([seed]),
    )

    const payload: TaskUpdatePayload = {
      id: 's1',
      type: AITaskType.Summary,
      scope: 'ai',
      phase: 'started',
      patch: { status: AITaskStatus.Running, startedAt: 42 },
    }
    handleTaskUpdate(queryClient, payload)

    expect(
      queryClient.getQueryData<AITask>(adminQueryKeys.tasks.taskDetail('s1'))
        ?.status,
    ).toBe(AITaskStatus.Running)
    const list = queryClient.getQueryData<AITasksResponse>(
      adminQueryKeys.tasks.tasks(TASKS_PARAMS),
    )
    expect(list?.data[0].status).toBe(AITaskStatus.Running)
    expect(list?.data[0].startedAt).toBe(42)
  })

  it("'status' patches BOTH detail and list", () => {
    const seed = makeTask({ id: 's2', status: AITaskStatus.Running })
    queryClient.setQueryData(adminQueryKeys.tasks.taskDetail('s2'), seed)
    queryClient.setQueryData(
      adminQueryKeys.tasks.tasks(TASKS_PARAMS),
      makeListResponse([seed]),
    )

    handleTaskUpdate(queryClient, {
      id: 's2',
      type: AITaskType.Summary,
      scope: 'ai',
      phase: 'status',
      patch: { status: AITaskStatus.Completed },
    } satisfies TaskUpdatePayload)

    expect(
      queryClient.getQueryData<AITask>(adminQueryKeys.tasks.taskDetail('s2'))
        ?.status,
    ).toBe(AITaskStatus.Completed)
    expect(
      queryClient.getQueryData<AITasksResponse>(
        adminQueryKeys.tasks.tasks(TASKS_PARAMS),
      )?.data[0].status,
    ).toBe(AITaskStatus.Completed)
  })

  it("'result' patches BOTH detail and list", () => {
    const seed = makeTask({ id: 'r1', status: AITaskStatus.Running })
    queryClient.setQueryData(adminQueryKeys.tasks.taskDetail('r1'), seed)
    queryClient.setQueryData(
      adminQueryKeys.tasks.tasks(TASKS_PARAMS),
      makeListResponse([seed]),
    )

    handleTaskUpdate(queryClient, {
      id: 'r1',
      type: AITaskType.Summary,
      scope: 'ai',
      phase: 'result',
      patch: {
        status: AITaskStatus.Completed,
        completedAt: 99,
        result: { ok: 1 },
      },
    } satisfies TaskUpdatePayload)

    const detail = queryClient.getQueryData<AITask>(
      adminQueryKeys.tasks.taskDetail('r1'),
    )
    expect(detail?.status).toBe(AITaskStatus.Completed)
    expect(detail?.result).toEqual({ ok: 1 })
    const list = queryClient.getQueryData<AITasksResponse>(
      adminQueryKeys.tasks.tasks(TASKS_PARAMS),
    )
    expect(list?.data[0].completedAt).toBe(99)
  })

  it('wholesale-replaces the parent group subTaskStats on a child emit', () => {
    const parent = makeTask({
      id: 'g1',
      type: AITaskType.TranslationBatch,
      subTaskStats: {
        completed: 0,
        failed: 0,
        pending: 5,
        running: 0,
        total: 5,
      },
    })
    queryClient.setQueryData(adminQueryKeys.tasks.taskDetail('g1'), parent)
    const child = makeTask({
      id: 'c1',
      type: AITaskType.Translation,
      groupId: 'g1',
    })
    queryClient.setQueryData(adminQueryKeys.tasks.taskDetail('c1'), child)

    const nextStats = {
      completed: 1,
      failed: 0,
      pending: 4,
      running: 0,
      total: 5,
    }
    handleTaskUpdate(queryClient, {
      id: 'c1',
      type: AITaskType.Translation,
      scope: 'ai',
      phase: 'status',
      groupId: 'g1',
      patch: { status: AITaskStatus.Completed, subTaskStats: nextStats },
    } satisfies TaskUpdatePayload)

    const updatedParent = queryClient.getQueryData<AITask>(
      adminQueryKeys.tasks.taskDetail('g1'),
    )
    // Wholesale replace contract — every field of the incoming stats appears
    // on the parent (TanStack Query's structural sharing may rewrite the
    // object reference, so compare by value not identity).
    expect(updatedParent?.subTaskStats).toEqual(nextStats)
    // And the prev parent stats were really replaced, not merged.
    expect(updatedParent?.subTaskStats?.completed).toBe(1)
  })

  it('keeps the parent child-list cache live on child status updates', () => {
    const child = makeTask({
      id: 'c2',
      type: AITaskType.Translation,
      groupId: 'g2',
      status: AITaskStatus.Pending,
    })
    queryClient.setQueryData(adminQueryKeys.tasks.tasksByGroup('g2'), [child])

    handleTaskUpdate(queryClient, {
      id: 'c2',
      type: AITaskType.Translation,
      scope: 'ai',
      phase: 'status',
      groupId: 'g2',
      patch: { status: AITaskStatus.Completed },
    } satisfies TaskUpdatePayload)

    const groupChildren = queryClient.getQueryData<AITask[]>(
      adminQueryKeys.tasks.tasksByGroup('g2'),
    )
    expect(groupChildren?.[0].status).toBe(AITaskStatus.Completed)
  })

  it("'created' appends a brand-new child to the parent's child-list cache", () => {
    queryClient.setQueryData(adminQueryKeys.tasks.tasksByGroup('g3'), [])
    const fresh = makeTask({
      id: 'c3',
      type: AITaskType.Translation,
      groupId: 'g3',
    })

    handleTaskUpdate(queryClient, {
      id: 'c3',
      type: AITaskType.Translation,
      scope: 'ai',
      phase: 'created',
      groupId: 'g3',
      patch: fresh,
    } satisfies TaskUpdatePayload)

    expect(
      queryClient.getQueryData<AITask[]>(
        adminQueryKeys.tasks.tasksByGroup('g3'),
      ),
    ).toEqual([fresh])
  })

  it('ignores payloads with missing required fields (defensive parse)', () => {
    const list = makeListResponse([makeTask({ id: 'x' })])
    queryClient.setQueryData(adminQueryKeys.tasks.tasks(TASKS_PARAMS), list)

    // Missing `phase`
    handleTaskUpdate(queryClient, { id: 'x' })
    // Missing `id`
    handleTaskUpdate(queryClient, { phase: 'status' })
    // Null/undefined
    handleTaskUpdate(queryClient, null)
    handleTaskUpdate(queryClient, undefined)

    expect(
      queryClient.getQueryData<AITasksResponse>(
        adminQueryKeys.tasks.tasks(TASKS_PARAMS),
      ),
    ).toBe(list)
  })

  it('is a no-op when the detail cache is empty (does not poison it)', () => {
    // No prior setQueryData for taskDetail('m1') — patch arrives in the wild.
    handleTaskUpdate(queryClient, {
      id: 'm1',
      type: AITaskType.Summary,
      scope: 'ai',
      phase: 'progress',
      patch: { progress: 50 },
    } satisfies TaskUpdatePayload)
    // Should remain undefined — applyTaskPatch only fires when prev exists.
    expect(
      queryClient.getQueryData(adminQueryKeys.tasks.taskDetail('m1')),
    ).toBeUndefined()
  })
})

// Sanity check — the spy wiring above relies on vi being callable.
describe('vi sanity', () => {
  it('vi.fn() is defined', () => {
    expect(typeof vi.fn).toBe('function')
  })
})
