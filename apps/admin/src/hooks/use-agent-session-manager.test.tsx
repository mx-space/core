import { createAgentStore } from '@haklex/rich-agent-core'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'

import { useAgentSessionManager } from './use-agent-session-manager'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  replace: vi.fn(),
  list: vi.fn(),
}))
vi.mock('../api/ai-agent', () => ({
  createAgentConversation: mocks.create,
  replaceAgentConversationMessages: mocks.replace,
  getAgentConversations: mocks.list,
  getAgentConversation: vi.fn(),
  deleteAgentConversation: vi.fn(),
  generateAgentConversationTitle: vi.fn(),
}))

it('persists tool results that arrive before conversation creation completes', async () => {
  const store = createAgentStore()
  let finish!: (value: unknown) => void
  mocks.list.mockResolvedValue([])
  mocks.create.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  mocks.replace.mockResolvedValue(null)
  function Harness() {
    useAgentSessionManager({
      store,
      sessionId: 'note:test',
      abort: () => {},
      getModel: () => 'test',
      getProviderId: () => 'test',
    })
    return null
  }
  const container = document.createElement('div')
  const root = createRoot(container)
  try {
    await act(async () => {
      root.render(<Harness />)
    })
    act(() => {
      store.setState({
        bubbles: [{ type: 'user', content: 'Revise component' }],
      })
    })
    const tool = {
      id: 'group',
      type: 'tool_call_group' as const,
      items: [
        {
          id: 'preview',
          toolName: 'preview_dynamic_component',
          params: {},
          status: 'completed' as const,
          result: '{"draft":{"source":"export default {}"}}',
        },
      ],
    }
    act(() => {
      store.setState({ bubbles: [...store.getState().bubbles, tool] })
    })
    await act(async () => {
      finish({
        id: 'conversation',
        sessionId: 'note:test',
        title: null,
        createdAt: '',
        updatedAt: '',
      })
    })
    expect(mocks.replace).toHaveBeenCalledWith(
      'conversation',
      expect.arrayContaining([tool]),
    )
  } finally {
    act(() => root.unmount())
  }
})

function renderManager(sessionId: string | undefined) {
  const store = createAgentStore()
  const api: { current?: ReturnType<typeof useAgentSessionManager> } = {}
  function Harness() {
    api.current = useAgentSessionManager({
      store,
      sessionId,
      abort: () => {},
      getModel: () => 'test',
      getProviderId: () => 'test',
    })
    return null
  }
  const container = document.createElement('div')
  const root = createRoot(container)
  return { api, root, store, render: () => root.render(<Harness />) }
}

it('ensureConversation joins the creation started by the first bubble', async () => {
  mocks.create.mockReset()
  mocks.list.mockResolvedValue([])
  mocks.replace.mockResolvedValue(null)
  let finish!: (value: unknown) => void
  mocks.create.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const { api, root, store, render } = renderManager('post:1')
  try {
    await act(async () => render())
    act(() => {
      store.setState({ bubbles: [{ type: 'user', content: 'hi' }] })
    })
    const ensured = api.current!.ensureConversation()
    await act(async () => {
      finish({
        id: 'conv-1',
        sessionId: 'post:1',
        title: null,
        createdAt: '',
        updatedAt: '',
      })
    })

    await expect(ensured).resolves.toBe('conv-1')
    expect(mocks.create).toHaveBeenCalledTimes(1)
  } finally {
    act(() => root.unmount())
  }
})

it('ensureConversation returns null for a document without a session id', async () => {
  mocks.create.mockReset()
  const { api, root, render } = renderManager(undefined)
  try {
    await act(async () => render())
    await expect(api.current!.ensureConversation()).resolves.toBeNull()
    expect(mocks.create).not.toHaveBeenCalled()
  } finally {
    act(() => root.unmount())
  }
})
