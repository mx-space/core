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
      return { ok: true }
    }),
  }
  const deliver = (event: string, payload: unknown) => {
    for (const handler of handlers.get(event) ?? []) handler(payload)
  }
  const files = [{ attach: true, content: '<p/>', path: '/selection.xml' }]
  const runtime = createWriteAgentRuntime({
    connectionLostMessage: 'lost',
    ensureConversation: async () => 'conv-1',
    getSocket: () => socket as unknown as WsClient,
    model: { modelId: 'm', providerId: 'p' } as any,
    sessionId: 'post:1',
    socketUnavailableMessage: 'unavailable',
    store: createAgentStore(),
    workspace: {
      snapshotFiles: () => files,
      tool: { name: 'bash' },
      touchedFiles: () => [],
    } as unknown as DocumentBashWorkspace,
  })
  return { deliver, files, requested, runtime }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('createWriteAgentRuntime steer', () => {
  it('refuses to steer when no run is active', async () => {
    const { runtime } = setup()

    await expect(runtime.steer('shorter')).resolves.toBe(false)
  })

  it('steers the active run with the current workspace files', async () => {
    const { deliver, files, requested, runtime } = setup()

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
      payload: { files, runId, user: 'shorter' },
    })

    deliver('agent.done', { runId, status: 'complete' })
    await done
    await expect(runtime.steer('late')).resolves.toBe(false)
  })
})
