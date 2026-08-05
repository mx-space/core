import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, createElement } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '~/i18n'

import { useTtsGeneration } from './use-tts-generation'

const { createTtsTaskMock, getTtsByRefIdMock, getTaskMock, toastErrorMock } =
  vi.hoisted(() => ({
    createTtsTaskMock: vi.fn(),
    getTtsByRefIdMock: vi.fn(),
    getTaskMock: vi.fn(),
    toastErrorMock: vi.fn(),
  }))

vi.mock('~/api/ai', () => ({
  createTtsTask: createTtsTaskMock,
  getTtsByRefId: getTtsByRefIdMock,
}))

vi.mock('~/api/tasks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~/api/tasks')>()
  return { ...actual, getTask: getTaskMock }
})

vi.mock('~/features/tasks/hooks/useTaskSubscription', () => ({
  useTaskDetailSubscription: () => ({ socketConnected: false }),
}))

vi.mock('sonner', () => ({
  toast: { error: toastErrorMock, success: vi.fn(), warning: vi.fn() },
}))

interface Harness {
  root: Root
  unmount: () => void
}

function mount(): Harness {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  return {
    root,
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

let latest: ReturnType<typeof useTtsGeneration> | undefined

function Probe(props: Parameters<typeof useTtsGeneration>[0]) {
  latest = useTtsGeneration(props)
  return null
}

async function flush(times = 3) {
  for (let i = 0; i < times; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }
}

let harness: Harness
let client: QueryClient

beforeEach(() => {
  harness = mount()
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  latest = undefined
  createTtsTaskMock.mockReset().mockResolvedValue({ taskId: 'task-1' })
  getTtsByRefIdMock.mockReset().mockResolvedValue([])
  getTaskMock.mockReset()
  toastErrorMock.mockReset()

  act(() => {
    harness.root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          I18nProvider,
          null,
          createElement(Probe, { enabled: true, refId: 'article-1' }),
        ),
      ),
    )
  })
})

afterEach(() => {
  harness.unmount()
  document.body.innerHTML = ''
})

describe('useTtsGeneration task polling', () => {
  it('leaves the panel runnable after the task poll fails', async () => {
    getTaskMock.mockRejectedValue(new Error('task not found'))
    await flush()

    act(() => {
      latest!.generate()
    })
    await flush()
    await flush()

    expect(latest!.isRunning).toBe(false)
    expect(latest!.runStatus).toBe('failed')
    expect(latest!.runError).toBe('task not found')
    expect(toastErrorMock).toHaveBeenCalledWith('task not found')
  })

  it('keeps running while the task is still pending', async () => {
    getTaskMock.mockResolvedValue({ id: 'task-1', status: 'running' })
    await flush()

    act(() => {
      latest!.generate()
    })
    await flush()
    await flush()

    expect(latest!.isRunning).toBe(true)
    expect(latest!.runStatus).toBe('running')
  })

  it('clears the run once the task completes', async () => {
    getTaskMock.mockResolvedValue({ id: 'task-1', status: 'completed' })
    await flush()

    act(() => {
      latest!.generate()
    })
    await flush(10)

    expect(latest!.isRunning).toBe(false)
    expect(latest!.runStatus).toBe('succeeded')
    expect(toastErrorMock).not.toHaveBeenCalled()
  })
})
