import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, createElement, useEffect, useRef } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { adminQueryKeys } from '~/query/keys'

type WsClientState = 'closed' | 'connecting' | 'open' | 'reconnecting'
type Listener = (payload?: unknown) => void

interface QueueEntry {
  event: string
  payload: unknown
  resolve: (value: unknown) => void
  reject: (error: unknown) => void
}

class MockWsClient {
  state: WsClientState = 'connecting'
  private readonly listeners = new Map<string, Set<Listener>>()
  private readonly queue: QueueEntry[] = []

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

  request(event: string, payload?: unknown) {
    return new Promise((resolve, reject) => {
      this.queue.push({ event, payload, resolve, reject })
    })
  }

  pending(event: string): QueueEntry[] {
    return this.queue.filter((entry) => entry.event === event)
  }

  resolveOldest(event: string, result: unknown = { ok: true }) {
    const idx = this.queue.findIndex((entry) => entry.event === event)
    if (idx === -1) throw new Error(`no pending request for ${event}`)
    const [entry] = this.queue.splice(idx, 1)
    entry.resolve(result)
  }

  rejectOldest(event: string, error: unknown = new Error('rejected')) {
    const idx = this.queue.findIndex((entry) => entry.event === event)
    if (idx === -1) throw new Error(`no pending request for ${event}`)
    const [entry] = this.queue.splice(idx, 1)
    entry.reject(error)
  }
}

let mockSocket: MockWsClient | null = null
const socketListeners = new Set<(s: MockWsClient | null) => void>()

function setMockSocket(next: MockWsClient | null) {
  mockSocket = next
  for (const listener of socketListeners) listener(next)
}

vi.mock('~/socket/SocketBridge', () => ({
  subscribeAdminSocket: (cb: (s: MockWsClient | null) => void) => {
    socketListeners.add(cb)
    cb(mockSocket)
    return () => {
      socketListeners.delete(cb)
    }
  },
  getAdminSocket: () => mockSocket,
}))

const { useTaskListSubscription, useTaskDetailSubscription } =
  await import('./useTaskSubscription')

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

async function flush() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

function StatusProbe(props: {
  onConnectedChange?: (next: boolean) => void
  scope: 'detail' | 'list'
  taskId?: string
}) {
  const result =
    props.scope === 'list'
      ? useTaskListSubscription()
      : useTaskDetailSubscription(props.taskId)
  const last = useRef<boolean | null>(null)
  useEffect(() => {
    if (last.current !== result.socketConnected) {
      last.current = result.socketConnected
      props.onConnectedChange?.(result.socketConnected)
    }
  }, [result.socketConnected, props])
  return createElement(
    'span',
    { 'data-testid': 'status' },
    result.socketConnected ? 'connected' : 'paused',
  )
}

let harness: Harness
let queryClient: QueryClient

beforeEach(() => {
  setMockSocket(null)
  harness = mount()
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
})

afterEach(() => {
  setMockSocket(null)
  socketListeners.clear()
  harness.unmount()
  document.body.innerHTML = ''
  queryClient.clear()
})

describe('useTaskListSubscription', () => {
  it('reports socketConnected=false while no socket exists, and sends no subscribe request', () => {
    act(() => {
      harness.root.render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(StatusProbe, { scope: 'list' }),
        ),
      )
    })
    expect(
      harness.container.querySelector('[data-testid="status"]')?.textContent,
    ).toBe('paused')
  })

  it('flips to connected when an open socket is installed and requests ai_task.subscribe', () => {
    const socket = new MockWsClient()
    socket.state = 'open'
    act(() => {
      setMockSocket(socket)
    })
    act(() => {
      harness.root.render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(StatusProbe, { scope: 'list' }),
        ),
      )
    })
    expect(
      harness.container.querySelector('[data-testid="status"]')?.textContent,
    ).toBe('connected')
    expect(socket.pending('ai_task.subscribe')).toHaveLength(1)
    expect(socket.pending('ai_task.subscribe')[0].payload).toEqual({
      all: true,
    })
  })

  it('does not resend ai_task.subscribe while the first request is still pending', () => {
    const socket = new MockWsClient()
    socket.state = 'open'
    setMockSocket(socket)
    act(() => {
      harness.root.render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(StatusProbe, { scope: 'list' }),
        ),
      )
    })
    expect(socket.pending('ai_task.subscribe')).toHaveLength(1)

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(socket.pending('ai_task.subscribe')).toHaveLength(1)
  })

  it('unmounting before the subscribe ack resolves sends no unsubscribe request', async () => {
    const socket = new MockWsClient()
    socket.state = 'open'
    setMockSocket(socket)
    act(() => {
      harness.root.render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(StatusProbe, { scope: 'list' }),
        ),
      )
    })
    expect(socket.pending('ai_task.subscribe')).toHaveLength(1)

    act(() => {
      harness.unmount()
      harness = mount()
    })
    await flush()
    expect(socket.pending('ai_task.unsubscribe')).toHaveLength(0)
  })

  it('sends ai_task.unsubscribe on unmount only after the subscribe ack resolved ok:true', async () => {
    const socket = new MockWsClient()
    socket.state = 'open'
    setMockSocket(socket)
    act(() => {
      harness.root.render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(StatusProbe, { scope: 'list' }),
        ),
      )
    })
    act(() => {
      socket.resolveOldest('ai_task.subscribe')
    })
    await flush()

    act(() => {
      harness.unmount()
      harness = mount()
    })
    expect(socket.pending('ai_task.unsubscribe')).toHaveLength(1)
    expect(socket.pending('ai_task.unsubscribe')[0].payload).toEqual({
      all: true,
    })
  })

  it('a rejected ack (ok:false) leaves it unsubscribed — no unsubscribe request on unmount', async () => {
    const socket = new MockWsClient()
    socket.state = 'open'
    setMockSocket(socket)
    act(() => {
      harness.root.render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(StatusProbe, { scope: 'list' }),
        ),
      )
    })
    act(() => {
      socket.rejectOldest('ai_task.subscribe')
    })
    await flush()

    act(() => {
      harness.unmount()
      harness = mount()
    })
    expect(socket.pending('ai_task.unsubscribe')).toHaveLength(0)
  })

  it('disconnect flips socketConnected to false; reconnect re-issues ai_task.subscribe AND invalidates the tasks root cache', async () => {
    const socket = new MockWsClient()
    socket.state = 'open'
    setMockSocket(socket)

    act(() => {
      harness.root.render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(StatusProbe, { scope: 'list' }),
        ),
      )
    })
    act(() => {
      socket.resolveOldest('ai_task.subscribe')
    })
    await flush()

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    act(() => {
      socket.setState('reconnecting')
    })
    expect(
      harness.container.querySelector('[data-testid="status"]')?.textContent,
    ).toBe('paused')
    expect(invalidateSpy).not.toHaveBeenCalled()

    act(() => {
      socket.setState('open')
    })
    expect(
      harness.container.querySelector('[data-testid="status"]')?.textContent,
    ).toBe('connected')
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: adminQueryKeys.tasks.tasksRoot,
    })
    expect(socket.pending('ai_task.subscribe')).toHaveLength(1)
  })
})

describe('useTaskDetailSubscription', () => {
  it('requests ai_task.subscribe with the taskId payload', () => {
    const socket = new MockWsClient()
    socket.state = 'open'
    setMockSocket(socket)
    act(() => {
      harness.root.render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(StatusProbe, { scope: 'detail', taskId: 'task-99' }),
        ),
      )
    })
    expect(socket.pending('ai_task.subscribe')[0].payload).toEqual({
      taskId: 'task-99',
    })
  })

  it('does not subscribe when taskId is empty / undefined', () => {
    const socket = new MockWsClient()
    socket.state = 'open'
    setMockSocket(socket)
    act(() => {
      harness.root.render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(StatusProbe, {
            scope: 'detail',
            taskId: undefined,
          }),
        ),
      )
    })
    expect(socket.pending('ai_task.subscribe')).toHaveLength(0)
  })

  it('reconnect invalidates the per-detail cache key only when a taskId is supplied', async () => {
    const socket = new MockWsClient()
    socket.state = 'open'
    setMockSocket(socket)
    act(() => {
      harness.root.render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(StatusProbe, { scope: 'detail', taskId: 'task-50' }),
        ),
      )
    })
    act(() => {
      socket.resolveOldest('ai_task.subscribe')
    })
    await flush()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    act(() => {
      socket.setState('reconnecting')
    })
    act(() => {
      socket.setState('open')
    })

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: adminQueryKeys.tasks.taskDetail('task-50'),
    })
  })
})
