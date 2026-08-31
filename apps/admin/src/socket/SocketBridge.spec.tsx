import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, createElement } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AITask, AITaskLog, AITasksResponse } from '~/api/tasks'
import { AITaskStatus, AITaskType } from '~/api/tasks'
import { translate } from '~/i18n/translate'
import { adminQueryKeys } from '~/query/keys'

// Spec 2 step-27 — SocketBridge TASK_UPDATE phase routing (handleTaskUpdate,
// unchanged by the ws-client migration) plus the transport wiring added by
// it: module-singleton exposure, per-event dispatch to subscribers, and the
// DEV-only $state → toast mapping.

type WsClientState = 'closed' | 'connecting' | 'open' | 'reconnecting'
type Listener = (payload?: unknown) => void

// `~/api/tasks` (imported below for AITask types) pulls in `~/constants/env`
// transitively, which freezes GATEWAY_URL from `window.injectData` at import
// time. vi.hoisted runs before any import statement, so this must set
// injectData before that chain ever evaluates — a plain top-level assignment
// runs too late because import declarations are hoisted above it.
vi.hoisted(() => {
  ;(window as unknown as { injectData: Record<string, string> }).injectData = {
    GATEWAY: 'http://localhost:2333',
  }
})

class FakeWsClient {
  state: WsClientState = 'connecting'
  closed = false
  readonly options: { url: string }
  private readonly listeners = new Map<string, Set<Listener>>()

  constructor(options: { url: string }) {
    this.options = options
  }

  on(event: string, listener: Listener) {
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }
    set.add(listener)
    return () => {
      set!.delete(listener)
    }
  }

  emit(event: string, payload?: unknown) {
    const set = this.listeners.get(event)
    if (!set) return
    for (const fn of set) fn(payload)
  }

  setState(next: WsClientState) {
    this.state = next
    this.emit('$state', next)
  }

  send() {}

  request() {
    return new Promise(() => {})
  }

  close() {
    this.closed = true
  }
}

const instances: FakeWsClient[] = []

vi.mock('@mx-space/ws-client', () => ({
  createWsClient: (options: { url: string }) => {
    const client = new FakeWsClient(options)
    instances.push(client)
    return client
  },
}))

vi.mock('sonner', () => ({
  toast: {
    dismiss: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}))

const { SocketBridge, getAdminSocket, handleTaskUpdate } =
  await import('./SocketBridge')
const { EventTypes } = await import('./types')
const { toast } = await import('sonner')

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

    handleTaskUpdate(queryClient, {
      id: fresh.id,
      type: fresh.type,
      scope: 'ai',
      phase: 'created',
      patch: fresh,
    })

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
    })

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
    })

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

    handleTaskUpdate(queryClient, {
      id: 'b',
      type: AITaskType.Summary,
      scope: 'ai',
      phase: 'deleted',
    })

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

    handleTaskUpdate(queryClient, {
      id: 'c',
      type: AITaskType.Translation,
      scope: 'ai',
      phase: 'deleted',
      groupId: 'g',
    })

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

    const streamFrame = { lang: 'ja', chunk: 'token' }
    const events: Array<{
      taskId: string
      groupId?: string
      stream?: unknown
    }> = []
    const listener = (event: Event) => {
      events.push((event as CustomEvent).detail)
    }
    window.addEventListener('mx-admin:ai-task-stream', listener)
    try {
      handleTaskUpdate(queryClient, {
        id: 'sx',
        type: AITaskType.Translation,
        scope: 'ai',
        phase: 'stream',
        groupId: 'g1',
        stream: streamFrame,
      })
    } finally {
      window.removeEventListener('mx-admin:ai-task-stream', listener)
    }

    expect(events).toEqual([
      { taskId: 'sx', groupId: 'g1', stream: streamFrame },
    ])
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

    handleTaskUpdate(queryClient, {
      id: 'p1',
      type: AITaskType.Summary,
      scope: 'ai',
      phase: 'progress',
      patch: { progress: 75 },
    })

    expect(
      queryClient.getQueryData<AITask>(adminQueryKeys.tasks.taskDetail('p1'))
        ?.progress,
    ).toBe(75)
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
    handleTaskUpdate(queryClient, {
      id: 'l1',
      type: AITaskType.Summary,
      scope: 'ai',
      phase: 'log',
      log,
    })

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

    handleTaskUpdate(queryClient, {
      id: 's1',
      type: AITaskType.Summary,
      scope: 'ai',
      phase: 'started',
      patch: { status: AITaskStatus.Running, startedAt: 42 },
    })

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
    })

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
      },
      result: { ok: 1 },
    })

    const detail = queryClient.getQueryData<AITask>(
      adminQueryKeys.tasks.taskDetail('r1'),
    )
    expect(detail?.status).toBe(AITaskStatus.Completed)
    expect(detail?.result).toEqual({ ok: 1 })
    const list = queryClient.getQueryData<AITasksResponse>(
      adminQueryKeys.tasks.tasks(TASKS_PARAMS),
    )
    expect(list?.data[0].completedAt).toBe(99)
    expect(list?.data[0].result).toEqual({ ok: 1 })
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
    })

    const updatedParent = queryClient.getQueryData<AITask>(
      adminQueryKeys.tasks.taskDetail('g1'),
    )
    expect(updatedParent?.subTaskStats).toEqual(nextStats)
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
    })

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
    })

    expect(
      queryClient.getQueryData<AITask[]>(
        adminQueryKeys.tasks.tasksByGroup('g3'),
      ),
    ).toEqual([fresh])
  })

  it('ignores payloads with missing required fields (defensive parse)', () => {
    const list = makeListResponse([makeTask({ id: 'x' })])
    queryClient.setQueryData(adminQueryKeys.tasks.tasks(TASKS_PARAMS), list)

    handleTaskUpdate(queryClient, { id: 'x' })
    handleTaskUpdate(queryClient, { phase: 'status' })
    handleTaskUpdate(queryClient, null)
    handleTaskUpdate(queryClient, undefined)

    expect(
      queryClient.getQueryData<AITasksResponse>(
        adminQueryKeys.tasks.tasks(TASKS_PARAMS),
      ),
    ).toBe(list)
  })

  it('is a no-op when the detail cache is empty (does not poison it)', () => {
    handleTaskUpdate(queryClient, {
      id: 'm1',
      type: AITaskType.Summary,
      scope: 'ai',
      phase: 'progress',
      patch: { progress: 50 },
    })
    expect(
      queryClient.getQueryData(adminQueryKeys.tasks.taskDetail('m1')),
    ).toBeUndefined()
  })
})

interface Harness {
  container: HTMLDivElement
  root: Root
  unmount: () => void
}

function mount(): Harness {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  return {
    container,
    root,
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

function renderSocketBridge(harness: Harness) {
  act(() => {
    harness.root.render(
      createElement(
        MemoryRouter,
        null,
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(SocketBridge),
        ),
      ),
    )
  })
}

describe('SocketBridge — transport wiring', () => {
  let harness: Harness

  beforeEach(() => {
    instances.length = 0
    vi.mocked(toast.info).mockClear()
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.warning).mockClear()
    harness = mount()
  })

  afterEach(() => {
    harness.unmount()
    document.body.innerHTML = ''
  })

  it('connects to <gateway as ws scheme>/ws/admin and exposes the client via getAdminSocket(), clearing it on unmount', () => {
    renderSocketBridge(harness)
    expect(instances).toHaveLength(1)
    expect(instances[0].options.url).toBe('ws://localhost:2333/ws/admin')
    expect(getAdminSocket()).toBe(instances[0])

    harness.unmount()
    expect(getAdminSocket()).toBeNull()
  })

  it('dispatches an incoming business event to a window CustomEvent and to its cache/toast handler', () => {
    renderSocketBridge(harness)
    const client = instances[0]
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const events: Array<{ payload: unknown; type: string }> = []
    const listener = (event: Event) => {
      events.push((event as CustomEvent).detail)
    }
    window.addEventListener('mx-admin:socket-event', listener)
    try {
      client.emit(EventTypes.COMMENT_CREATE, { author: 'a', text: 'hi' })
    } finally {
      window.removeEventListener('mx-admin:socket-event', listener)
    }

    expect(events).toEqual([
      { payload: { author: 'a', text: 'hi' }, type: EventTypes.COMMENT_CREATE },
    ])
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: adminQueryKeys.comments.root,
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: adminQueryKeys.aggregate.root,
    })
    expect(toast.success).toHaveBeenCalled()
  })

  it('routes a TASK_UPDATE event through handleTaskUpdate', () => {
    renderSocketBridge(harness)
    const client = instances[0]
    queryClient.setQueryData(
      adminQueryKeys.tasks.taskDetail('wired-1'),
      makeTask({ id: 'wired-1' }),
    )

    client.emit(EventTypes.TASK_UPDATE, {
      id: 'wired-1',
      type: AITaskType.Summary,
      scope: 'ai',
      phase: 'deleted',
    })

    expect(
      queryClient.getQueryData(adminQueryKeys.tasks.taskDetail('wired-1')),
    ).toBeUndefined()
  })

  it('closes the client on an AUTH_FAILED event', () => {
    renderSocketBridge(harness)
    const client = instances[0]
    client.emit(EventTypes.AUTH_FAILED, undefined)
    expect(client.closed).toBe(true)
  })

  it('$state: first drop before ever connecting toasts socket.connectionError', () => {
    renderSocketBridge(harness)
    const client = instances[0]

    client.setState('reconnecting')

    expect(toast.info).toHaveBeenCalledWith(translate('socket.connectionError'))
    expect(toast.info).not.toHaveBeenCalledWith(
      translate('socket.reconnecting'),
    )
  })

  it('$state: the very first open fires no toast; a later drop+reopen maps to reconnecting/reconnectSuccess', () => {
    renderSocketBridge(harness)
    const client = instances[0]

    client.setState('open')
    expect(toast.info).not.toHaveBeenCalled()

    client.setState('reconnecting')
    expect(toast.info).toHaveBeenCalledWith(translate('socket.reconnecting'))

    client.setState('open')
    expect(toast.info).toHaveBeenCalledWith(
      translate('socket.reconnectSuccess'),
    )
  })
})
