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
})
