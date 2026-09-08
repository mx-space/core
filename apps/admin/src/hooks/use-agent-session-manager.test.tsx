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
