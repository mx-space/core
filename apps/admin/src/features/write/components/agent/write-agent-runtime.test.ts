import { createAgentStore } from '@haklex/rich-agent-core'
import type { WsClient } from '@mx-space/ws-client'
import { describe, expect, it, vi } from 'vitest'

import type { DocumentBashWorkspace } from '~/vendor/rich-editor/utils/document-bash'

import { createWriteAgentRuntime } from './write-agent-runtime'

function setup() {
  const handlers = new Map<string, Set<(payload: any) => void>>()
  const requested: Array<{ event: string; payload: any }> = []
  const socket = {
    state: 'open',
    on: (event: string, handler: (payload: any) => void) => {
      const set = handlers.get(event) ?? new Set()
      set.add(handler)
      handlers.set(event, set)
      return () => set.delete(handler)
    },
    send: vi.fn(),
    request: vi.fn(async (event: string, payload: unknown) => {
      requested.push({ event, payload })
      return event === 'agent.run'
        ? { ok: true, conversationId: 'conv-1' }
        : { ok: true }
    }),
  }
  const deliver = (event: string, payload: unknown) => {
    for (const handler of handlers.get(event) ?? []) handler(payload)
  }
  const files = [{ attach: true, content: '<p/>', path: '/selection.xml' }]
  const onConversation = vi.fn()
  const onReviewBatch = vi.fn()
  const store = createAgentStore()
  let conversationId: string | null = null
  const runtime = createWriteAgentRuntime({
    connectionLostMessage: 'lost',
    getConversationId: () => conversationId,
    onConversation: (id: string) => {
      conversationId = id
      onConversation(id)
    },
    onReviewBatch,
    getSocket: () => socket as unknown as WsClient,
    model: { modelId: 'm', providerId: 'p' } as any,
    sessionId: 'post:1',
    socketUnavailableMessage: 'unavailable',
    store,
    workspace: {
      snapshotFiles: () => files,
      tool: { name: 'bash' },
      touchedFiles: () => [],
    } as unknown as DocumentBashWorkspace,
  })
  return {
    deliver,
    files,
    onConversation,
    onReviewBatch,
    requested,
    runtime,
    store,
  }
}

async function flush() {
  const until = performance.now() + 20
  while (performance.now() < until) {
    await new Promise((resolve) => setImmediate(resolve))
  }
}

const runRequest = () => ({
  onOperationsChanged: () => {},
  signal: new AbortController().signal,
  systemMessages: [],
  tools: [],
  userInput: 'hello',
})

describe('createWriteAgentRuntime steer', () => {
  it('refuses to steer when no run is active', async () => {
    const { runtime } = setup()

    await expect(runtime.steer('shorter')).resolves.toBe(false)
  })

  it('steers the active run with the current workspace files', async () => {
    const { deliver, requested, runtime } = setup()

    const done = runtime.run({
      onOperationsChanged: () => {},
      signal: new AbortController().signal,
      systemMessages: [],
      tools: [],
      userInput: 'hello',
    })
    await flush()
    const runId = requested[0].payload.runId

    await expect(runtime.steer('shorter')).resolves.toBe(true)
    expect(requested[1]).toEqual({
      event: 'agent.steer',
      payload: {
        files: [
          {
            attach: true,
            hash: expect.stringMatching(/^[\da-f]{64}$/),
            path: '/selection.xml',
          },
        ],
        runId,
        user: 'shorter',
      },
    })

    deliver('agent.done', { runId, status: 'complete' })
    await done
    await expect(runtime.steer('late')).resolves.toBe(false)
  })
})

describe('createWriteAgentRuntime attachments', () => {
  const attachments = {
    files: [
      { attach: true, content: '# terms', path: '/attachments/glossary.md' },
    ],
    images: [{ mimeType: 'image/png', url: 'https://cdn.test/shot.png' }],
  }

  it('sends attached images and files with the run', async () => {
    const { deliver, requested, runtime } = setup()

    const done = runtime.run({ ...runRequest(), attachments })
    await flush()
    const { payload } = requested[0]

    expect(payload.images).toEqual(attachments.images)
    expect(payload.files.map((file: { path: string }) => file.path)).toEqual([
      '/selection.xml',
      '/attachments/glossary.md',
    ])
    deliver('agent.done', { runId: payload.runId, status: 'complete' })
    await done
  })

  it('sends attached images and files with a steer', async () => {
    const { deliver, requested, runtime } = setup()
    const done = runtime.run(runRequest())
    await flush()
    const runId = requested[0].payload.runId

    await runtime.steer('like this', attachments)

    expect(requested[1].payload.images).toEqual(attachments.images)
    expect(
      requested[1].payload.files.map((file: { path: string }) => file.path),
    ).toContain('/attachments/glossary.md')
    deliver('agent.done', { runId, status: 'complete' })
    await done
  })
})

describe('createWriteAgentRuntime conversation and wire state', () => {
  it('adopts the conversation id the server assigned', async () => {
    const { deliver, onConversation, requested, runtime } = setup()

    const done = runtime.run(runRequest())
    await flush()
    expect(requested[0].payload.conversationId).toBeNull()
    expect(onConversation).toHaveBeenCalledWith('conv-1')
    deliver('agent.done', {
      runId: requested[0].payload.runId,
      status: 'complete',
    })
    await done

    const next = runtime.run(runRequest())
    await flush()
    expect(requested[1].payload.conversationId).toBe('conv-1')
    deliver('agent.done', {
      runId: requested[1].payload.runId,
      status: 'complete',
    })
    await next
  })

  it('keeps the wire baseline across runs', async () => {
    const { deliver, requested, runtime } = setup()

    for (const index of [0, 1]) {
      const done = runtime.run(runRequest())
      await flush()
      deliver('agent.done', {
        runId: requested[index].payload.runId,
        status: 'complete',
      })
      await done
    }

    expect(requested[1].payload.system).toBeUndefined()
    expect(requested[1].payload.files[0]).toHaveProperty('hash')
  })

  it('forgets the wire baseline when the socket leaves open', async () => {
    const { deliver, requested, runtime } = setup()

    const done = runtime.run(runRequest())
    await flush()
    deliver('agent.done', {
      runId: requested[0].payload.runId,
      status: 'complete',
    })
    await done
    deliver('$state', 'reconnecting')
    deliver('$state', 'open')

    const next = runtime.run(runRequest())
    await flush()
    expect(requested[1].payload.system).toEqual([])
    expect(requested[1].payload.files[0]).toHaveProperty('content')
    deliver('agent.done', {
      runId: requested[1].payload.runId,
      status: 'complete',
    })
    await next
  })
})

describe('createWriteAgentRuntime review anchors', () => {
  it('reports each new review batch with the tool call that produced it', async () => {
    const { deliver, onReviewBatch, requested, runtime, store } = setup()
    const batch = (id: string) =>
      ({ entries: [], id, status: 'pending' }) as any

    const done = runtime.run({
      ...runRequest(),
      onOperationsChanged: () => {
        const existing = store.getState().reviewState?.batches ?? []
        store.getState().setReviewState({
          batches: existing.length ? existing : [batch('b_1')],
          documentRevision: 0,
        } as any)
      },
      tools: [
        {
          description: 'edit',
          execute: async () => ({
            content: '',
            ok: true as const,
            operations: [{ blockId: 'a', op: 'delete' } as any],
          }),
          name: 'edit',
          parameters: {},
        },
      ],
    })
    await flush()
    const runId = requested[0].payload.runId
    for (const toolCallId of ['c1', 'c2']) {
      deliver('agent.tool.call', {
        runId,
        toolCallId,
        name: 'edit',
        arguments: {},
      })
      await flush()
    }
    deliver('agent.done', { runId, status: 'complete' })
    await done

    expect(onReviewBatch.mock.calls).toEqual([['b_1', 'c1']])
  })
})
