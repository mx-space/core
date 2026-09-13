import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, createElement } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AITaskStatus, getTasks } from '~/api/tasks'
import { I18nProvider } from '~/i18n'

import { PublishProcessDock } from './PublishProcessDock'

vi.mock('~/api/tasks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/api/tasks')>()),
  getTasks: vi.fn(),
}))

vi.mock('~/features/tasks/hooks/useTaskSubscription', () => ({
  useTaskDetailSubscription: () => ({ socketConnected: false }),
  useTaskListSubscription: () => ({ socketConnected: false }),
}))

let container: HTMLDivElement
let queryClient: QueryClient
let root: Root

beforeEach(() => {
  localStorage.clear()
  container = document.createElement('div')
  document.body.append(container)
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  queryClient.clear()
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('PublishProcessDock', () => {
  it('restores an active publish task from the server on a fresh mount', async () => {
    vi.mocked(getTasks).mockResolvedValue({
      data: [
        {
          id: 'publish-running',
          payload: {
            aiResources: [],
            draftId: 'draft-1',
            draftVersion: 3,
            operation: 'online-update',
            refId: 'post-1',
            refType: 'post',
            snapshot: { title: 'Server task title' },
          },
          progress: 42,
          status: AITaskStatus.Running,
        },
      ],
    } as never)

    act(() => {
      root.render(
        createElement(
          MemoryRouter,
          null,
          createElement(
            QueryClientProvider,
            { client: queryClient },
            createElement(
              I18nProvider,
              null,
              createElement(PublishProcessDock),
            ),
          ),
        ),
      )
    })

    await act(async () => {
      await vi.waitFor(() => {
        expect(getTasks).toHaveBeenCalledOnce()
        expect(container.textContent).toContain('正在准备 AI 资源')
        expect(container.textContent).toContain('42%')
      })
    })
  })

  it('clears all finished tasks at once', async () => {
    const makeTask = (id: string) => ({
      id,
      payload: {
        aiResources: [],
        draftId: id,
        draftVersion: 1,
        operation: 'online-update',
        refId: id,
        refType: 'post',
        snapshot: { title: id },
      },
      progress: 100,
      status: AITaskStatus.Completed,
    })
    vi.mocked(getTasks).mockResolvedValue({
      data: [makeTask('done-1'), makeTask('done-2')],
    } as never)

    act(() => {
      root.render(
        createElement(
          MemoryRouter,
          null,
          createElement(
            QueryClientProvider,
            { client: queryClient },
            createElement(
              I18nProvider,
              null,
              createElement(PublishProcessDock),
            ),
          ),
        ),
      )
    })

    await act(async () => {
      await vi.waitFor(() => {
        expect(container.textContent).toContain('2')
      })
    })
    act(() => {
      container.querySelector<HTMLButtonElement>('button')!.click()
    })
    await act(async () => {
      await vi.waitFor(() => {
        expect(document.body.textContent).toContain('清理已结束')
      })
    })
    act(() => {
      ;[...document.body.querySelectorAll('button')]
        .find((el) => el.textContent === '清理已结束')!
        .click()
    })
    await act(async () => {
      await vi.waitFor(() => {
        expect(container.textContent).toBe('')
      })
    })
  })

  it('auto-dismisses completed tasks while the dock is closed', async () => {
    vi.useFakeTimers()
    vi.mocked(getTasks).mockResolvedValue({
      data: [
        {
          id: 'done-auto',
          payload: {
            aiResources: [],
            draftId: 'd',
            draftVersion: 1,
            operation: 'online-update',
            refId: 'p',
            refType: 'post',
            snapshot: { title: 'Done' },
          },
          progress: 100,
          status: AITaskStatus.Completed,
        },
      ],
    } as never)

    act(() => {
      root.render(
        createElement(
          MemoryRouter,
          null,
          createElement(
            QueryClientProvider,
            { client: queryClient },
            createElement(
              I18nProvider,
              null,
              createElement(PublishProcessDock),
            ),
          ),
        ),
      )
    })

    await act(async () => {
      await vi.waitFor(() => {
        expect(container.textContent).toContain('已更新')
      })
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000)
    })
    expect(container.textContent).toBe('')
    vi.useRealTimers()
  })
})
