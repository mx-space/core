import { createAgentStore } from '@haklex/rich-agent-core'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { useAgentSessionManager } from './use-agent-session-manager'

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  detail: vi.fn(),
  remove: vi.fn(),
  title: vi.fn(),
  update: vi.fn(),
  saveReview: vi.fn(),
}))
vi.mock('../api/ai-agent', () => ({
  getAgentConversations: mocks.list,
  getAgentConversation: mocks.detail,
  deleteAgentConversation: mocks.remove,
  generateAgentConversationTitle: mocks.title,
  updateAgentConversation: mocks.update,
  saveAgentConversationReviewState: mocks.saveReview,
}))

const meta = (id: string, title: string | null = null) => ({
  id,
  sessionId: 'post:1',
  model: 'm',
  providerId: 'p',
  title,
  createdAt: '2026-11-07T00:00:00.000Z',
  updatedAt: '2026-11-07T00:00:00.000Z',
})

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset()
  mocks.list.mockResolvedValue([])
  mocks.saveReview.mockResolvedValue(undefined)
  mocks.update.mockImplementation(async (id: string, data: object) => ({
    ...meta(id),
    ...data,
  }))
})

afterEach(() => {
  vi.useRealTimers()
})

function renderManager(initialSessionId: string | undefined) {
  const store = createAgentStore()
  const api: { current?: ReturnType<typeof useAgentSessionManager> } = {}
  let sessionId = initialSessionId
  function Harness() {
    api.current = useAgentSessionManager({
      abort: () => {},
      describeToolCall: (name, params) => `${name}(${String(params.command)})`,
      sessionId,
      store,
    })
    return null
  }
  const root = createRoot(document.createElement('div'))
  return {
    api,
    store,
    render: () => act(async () => root.render(<Harness />)),
    rerenderWith: (next: string | undefined) => {
      sessionId = next
      return act(async () => root.render(<Harness />))
    },
    unmount: () => act(() => root.unmount()),
  }
}

it('hydrates bubbles, review state and anchors from the conversation detail', async () => {
  const reviewState = { batches: [{ id: 'b_1' }], documentRevision: 1 }
  mocks.list.mockResolvedValue([meta('conv-1', 'Intro rewrite')])
  mocks.detail.mockResolvedValue({
    ...meta('conv-1', 'Intro rewrite'),
    bubbles: [
      { type: 'user', content: 'Rewrite the intro' },
      {
        type: 'tool_call_group',
        id: 'tcg-1',
        items: [
          {
            id: 'c1',
            toolName: 'bash',
            params: { command: 'cat /doc.xml' },
            status: 'completed',
            resultPreview: '<doc>',
            truncated: true,
          },
        ],
      },
      { type: 'diff_review', batchId: 'b_1' },
    ],
    reviewState,
    anchors: [{ batchId: 'b_1', toolCallId: 'c1' }],
  })
  const view = renderManager('post:1')
  try {
    await view.render()

    expect(view.api.current!.activeSessionId).toBe('conv-1')
    expect(view.store.getState().reviewState).toEqual(reviewState)
    const group = view.store.getState().bubbles[1]
    expect(group).toMatchObject({
      items: [{ description: 'bash(cat /doc.xml)', id: 'c1' }],
    })
    expect(view.api.current!.getActiveConversationId()).toBe('conv-1')
  } finally {
    await view.unmount()
  }
})

it('restores the attachments of a user message', async () => {
  mocks.list.mockResolvedValue([meta('conv-1')])
  mocks.detail.mockResolvedValue({
    ...meta('conv-1'),
    bubbles: [
      {
        type: 'user',
        content: 'Widen this box',
        images: [{ url: 'https://cdn.test/a/shot.png', mimeType: 'image/png' }],
        files: ['/attachments/glossary.md'],
      },
    ],
    reviewState: null,
    anchors: [],
  })
  const view = renderManager('post:1')
  try {
    await view.render()

    expect(view.store.getState().bubbles[0]).toEqual({
      type: 'user',
      content: 'Widen this box',
      attachments: [
        { kind: 'image', name: 'shot.png', url: 'https://cdn.test/a/shot.png' },
        { kind: 'file', name: 'glossary.md' },
      ],
    })
  } finally {
    await view.unmount()
  }
})

it('adopts a conversation the server created without any REST create call', async () => {
  const view = renderManager('post:1')
  try {
    await view.render()
    act(() => {
      view.store.setState({
        bubbles: [{ type: 'user', content: 'Draft an outline please' }],
      })
    })
    await act(async () => view.api.current!.adoptConversation('conv-9'))

    expect(view.api.current!.activeSessionId).toBe('conv-9')
    expect(view.api.current!.sessions[0]).toMatchObject({
      id: 'conv-9',
      derivedTitle: 'Draft an outline please',
    })
    expect(view.store.getState().bubbles).toHaveLength(1)
  } finally {
    await view.unmount()
  }
})

it('saves review state with the anchors of batches still under review', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const view = renderManager('post:1')
  try {
    await view.render()
    await act(async () => view.api.current!.adoptConversation('conv-1'))
    view.api.current!.recordAnchor('b_1', 'c1')
    view.api.current!.recordAnchor('gone', 'c0')
    const reviewState = {
      batches: [{ id: 'b_1' }],
      documentRevision: 1,
    } as any
    act(() => {
      view.store.setState({ reviewState })
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })

    expect(mocks.saveReview).toHaveBeenCalledWith('conv-1', {
      anchors: [{ batchId: 'b_1', toolCallId: 'c1' }],
      reviewState,
    })
  } finally {
    await view.unmount()
  }
})

it('moves the active conversation to the document session once the document has an id', async () => {
  const view = renderManager(undefined)
  try {
    await view.render()
    act(() => {
      view.store.setState({ bubbles: [{ type: 'user', content: 'hi' }] })
    })
    await act(async () => view.api.current!.adoptConversation('conv-1'))

    await view.rerenderWith('post:42')

    expect(mocks.update).toHaveBeenCalledWith('conv-1', {
      sessionId: 'post:42',
    })
    expect(mocks.list).not.toHaveBeenCalled()
    expect(view.api.current!.activeSessionId).toBe('conv-1')
    expect(view.store.getState().bubbles).toHaveLength(1)
  } finally {
    await view.unmount()
  }
})

it('generates a title once after the first finished run', async () => {
  mocks.title.mockResolvedValue(meta('conv-1', 'Outline draft'))
  const view = renderManager('post:1')
  try {
    await view.render()
    await act(async () => view.api.current!.adoptConversation('conv-1'))

    await act(async () => view.api.current!.onRunFinished())
    await act(async () => view.api.current!.onRunFinished())

    expect(mocks.title).toHaveBeenCalledTimes(1)
    expect(view.api.current!.sessions[0].title).toBe('Outline draft')
  } finally {
    await view.unmount()
  }
})

it('tries the title again after a run that left nothing to title', async () => {
  mocks.title
    .mockResolvedValueOnce(meta('conv-1'))
    .mockResolvedValueOnce(meta('conv-1', 'Outline draft'))
  const view = renderManager('post:1')
  try {
    await view.render()
    await act(async () => view.api.current!.adoptConversation('conv-1'))

    await act(async () => view.api.current!.onRunFinished())
    await act(async () => view.api.current!.onRunFinished())

    expect(mocks.title).toHaveBeenCalledTimes(2)
    expect(view.api.current!.sessions[0].title).toBe('Outline draft')
  } finally {
    await view.unmount()
  }
})

it('does not write review state across sessions when switching or starting anew', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const detail = (id: string, batchId: string) => ({
    ...meta(id),
    bubbles: [],
    reviewState: { batches: [{ id: batchId }], documentRevision: 1 },
    anchors: [{ batchId, toolCallId: `call-${id}` }],
  })
  mocks.list.mockResolvedValue([meta('A'), meta('B')])
  mocks.detail.mockImplementation(async (id: string) =>
    detail(id, id === 'A' ? 'a_1' : 'b_1'),
  )
  const view = renderManager('post:1')
  try {
    await view.render()
    await act(async () => view.api.current!.switchSession('B'))
    await act(async () => view.api.current!.createSession())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })

    expect(mocks.saveReview).not.toHaveBeenCalled()
  } finally {
    await view.unmount()
  }
})
