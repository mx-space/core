import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, createElement, useEffect, useRef } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { adminQueryKeys } from '~/query/keys'

// Spec 2 step-27 — useTaskSubscription connection-fallback contract.
//
// We mock the SocketBridge module to expose a deterministic
// subscribeAdminSocket implementation backed by a tiny EventEmitter-style
// mock socket. The hook tests then assert:
//   - socketConnected toggles when the socket connect/disconnect events fire
//   - reconnect triggers invalidateQueries on the right cache key
//   - the hook emits ai-task:subscribe + ai-task:unsubscribe with the right
//     payload shape

type Listener = (...args: unknown[]) => void

class MockSocket {
  connected = false
  // Map of event name → listeners
  private readonly listeners = new Map<string, Set<Listener>>()
  readonly emits: Array<{ event: string; payload: unknown }> = []

  on(event: string, listener: Listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(listener)
  }

  off(event: string, listener: Listener) {
    this.listeners.get(event)?.delete(listener)
  }

  emit(event: string, payload?: unknown) {
    this.emits.push({ event, payload })
  }

  // Test-only — fire a fake server-side event into the local listeners
  trigger(event: string, ...args: unknown[]) {
    const set = this.listeners.get(event)
    if (!set) return
    for (const fn of set) fn(...args)
  }

  setConnected(value: boolean) {
    this.connected = value
    this.trigger(value ? 'connect' : 'disconnect')
  }
}

let mockSocket: MockSocket | null = null
const socketListeners = new Set<(s: MockSocket | null) => void>()

function setMockSocket(next: MockSocket | null) {
  mockSocket = next
  for (const listener of socketListeners) listener(next)
}

vi.mock('~/socket/SocketBridge', () => ({
  subscribeAdminSocket: (cb: (s: MockSocket | null) => void) => {
    socketListeners.add(cb)
    cb(mockSocket)
    return () => {
      socketListeners.delete(cb)
    }
  },
  getAdminSocket: () => mockSocket,
}))

// Import the hook AFTER vi.mock so the mocked module is wired in.
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
  it('reports socketConnected=false while no socket exists, and emits no subscribe', () => {
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

  it('flips to connected when a connected socket is installed and emits the list subscribe payload', () => {
    const socket = new MockSocket()
    socket.connected = true
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
    expect(socket.emits).toContainEqual({
      event: 'ai-task:subscribe',
      payload: { all: true },
    })
  })

  it('disconnect flips socketConnected to false; reconnect flips back AND invalidates the tasks root cache', () => {
    const socket = new MockSocket()
    socket.connected = true
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

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    act(() => {
      socket.setConnected(false)
    })
    expect(
      harness.container.querySelector('[data-testid="status"]')?.textContent,
    ).toBe('paused')
    expect(invalidateSpy).not.toHaveBeenCalled()

    act(() => {
      socket.setConnected(true)
    })
    expect(
      harness.container.querySelector('[data-testid="status"]')?.textContent,
    ).toBe('connected')
    // reconnect → onCatchUp → invalidateQueries on the tasks root key
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: adminQueryKeys.tasks.tasksRoot,
    })
  })

  it('emits ai-task:unsubscribe on unmount', () => {
    const socket = new MockSocket()
    socket.connected = true
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
    expect(
      socket.emits.some(
        (e) =>
          e.event === 'ai-task:subscribe' &&
          JSON.stringify(e.payload) === JSON.stringify({ all: true }),
      ),
    ).toBe(true)

    act(() => {
      harness.unmount()
      // Re-mount so afterEach's harness.unmount() is a no-op shape
      harness = mount()
    })
    expect(
      socket.emits.some(
        (e) =>
          e.event === 'ai-task:unsubscribe' &&
          JSON.stringify(e.payload) === JSON.stringify({ all: true }),
      ),
    ).toBe(true)
  })
})

describe('useTaskDetailSubscription', () => {
  it('emits ai-task:subscribe with the taskId payload', () => {
    const socket = new MockSocket()
    socket.connected = true
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
    expect(socket.emits).toContainEqual({
      event: 'ai-task:subscribe',
      payload: { taskId: 'task-99' },
    })
  })

  it('does not subscribe when taskId is empty / undefined', () => {
    const socket = new MockSocket()
    socket.connected = true
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
    expect(
      socket.emits.filter((e) => e.event === 'ai-task:subscribe'),
    ).toHaveLength(0)
  })

  it('reconnect invalidates the per-detail cache key only when a taskId is supplied', () => {
    const socket = new MockSocket()
    socket.connected = true
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
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    act(() => {
      socket.setConnected(false)
    })
    act(() => {
      socket.setConnected(true)
    })

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: adminQueryKeys.tasks.taskDetail('task-50'),
    })
  })
})
