import type { AgentOperation, AgentToolConfig } from '@haklex/rich-agent-core'
import { createAgentStore } from '@haklex/rich-agent-core'
import { applyFilePatch } from '@mx-space/ai'
import type { WsAckPayload } from '@mx-space/ws-client'
import { describe, expect, it, vi } from 'vitest'

import { createAgentWireClient } from './agent-wire-client'
import {
  type AgentSocketPort,
  createServerAgentRunner,
  type ServerAgentRunInput,
} from './server-agent-runner'

function createFakeSocket(
  ack: WsAckPayload = { ok: true, conversationId: 'conv-1' },
  acks: Record<string, WsAckPayload | WsAckPayload[]> = {},
) {
  const handlers = new Map<string, Set<(payload: any) => void>>()
  const sent: Array<{ event: string; payload: any }> = []
  const requested: Array<{ event: string; payload: any }> = []
  const socket: AgentSocketPort = {
    on: (event, handler) => {
      const set = handlers.get(event) ?? new Set()
      set.add(handler)
      handlers.set(event, set)
      return () => set.delete(handler)
    },
    send: (event, payload) => sent.push({ event, payload }),
    request: async (event, payload) => {
      requested.push({ event, payload })
      const queued = acks[event]
      const reply =
        (Array.isArray(queued) ? queued.shift() : queued) ??
        (event === 'agent.run' ? ack : { ok: true })
      if (!reply.ok) {
        throw Object.assign(new Error('rejected'), {
          ack: reply,
          code: reply.code,
        })
      }
      return reply
    },
  }
  const deliver = (event: string, payload: unknown) => {
    for (const handler of handlers.get(event) ?? []) handler(payload)
  }
  return { socket, sent, requested, deliver }
}

const input: ServerAgentRunInput = {
  conversationId: 'conv-1',
  files: [],
  model: 'm',
  providerId: 'p',
  sessionId: 'post:1',
  system: ['sys'],
  user: 'hello',
}

function tool(overrides: Partial<AgentToolConfig> = {}): AgentToolConfig {
  return {
    description: 'run a command',
    execute: vi.fn(async () => ({ content: 'listing', ok: true as const })),
    name: 'bash',
    parameters: { properties: {}, type: 'object' },
    ...overrides,
  }
}

async function flush() {
  const until = performance.now() + 20
  while (performance.now() < until) {
    await new Promise((resolve) => setImmediate(resolve))
  }
}

describe('createServerAgentRunner', () => {
  it('sends the run with the tool schemas and streams text into an assistant bubble', async () => {
    const fake = createFakeSocket()
    const store = createAgentStore()
    const runner = createServerAgentRunner({
      socket: fake.socket,
      store,
      tools: [tool()],
    })

    const done = runner.run(input)
    await flush()
    const runId = fake.requested[0].payload.runId
    expect(fake.requested[0]).toMatchObject({
      event: 'agent.run',
      payload: {
        ...input,
        tools: [
          {
            description: 'run a command',
            name: 'bash',
            parameters: { properties: {}, type: 'object' },
          },
        ],
      },
    })

    fake.deliver('agent.event', {
      runId,
      event: { type: 'text_delta', contentIndex: 0, delta: 'Hel' },
    })
    fake.deliver('agent.event', {
      runId,
      event: { type: 'text_delta', contentIndex: 0, delta: 'lo' },
    })
    fake.deliver('agent.event', {
      runId,
      event: { type: 'done', message: {} },
    })
    fake.deliver('agent.done', { runId, status: 'complete' })

    await expect(done).resolves.toEqual({ runId, status: 'complete' })
    expect(store.getState().bubbles).toEqual([
      { content: 'Hello', streaming: false, type: 'assistant' },
    ])
    expect(store.getState().status).toBe('done')
  })

  it('executes a client tool and replies with its result and touched files', async () => {
    const fake = createFakeSocket()
    const store = createAgentStore()
    const bash = tool()
    const runner = createServerAgentRunner({
      collectFiles: () => [{ content: '<doc/>', path: '/doc.xml' }],
      socket: fake.socket,
      store,
      tools: [bash],
    })

    const done = runner.run(input)
    await flush()
    const runId = fake.requested[0].payload.runId
    fake.deliver('agent.event', {
      runId,
      event: {
        type: 'toolcall_end',
        contentIndex: 0,
        toolCall: { id: 'c1', name: 'bash', arguments: { command: 'ls' } },
      },
    })
    fake.deliver('agent.tool.call', {
      runId,
      toolCallId: 'c1',
      name: 'bash',
      arguments: { command: 'ls' },
    })
    await flush()

    expect(bash.execute).toHaveBeenCalledWith({ command: 'ls' })
    expect(fake.requested).toContainEqual({
      event: 'agent.tool.result',
      payload: {
        content: 'listing',
        files: [{ content: '<doc/>', path: '/doc.xml' }],
        isError: false,
        runId,
        toolCallId: 'c1',
      },
    })
    const group = store
      .getState()
      .bubbles.find((b) => b.type === 'tool_call_group')
    expect(group).toMatchObject({
      items: [{ id: 'c1', result: 'listing', status: 'completed' }],
    })

    fake.deliver('agent.done', { runId, status: 'complete' })
    await done
  })

  it('forwards images a client tool returned', async () => {
    const fake = createFakeSocket()
    const bash = tool({
      execute: vi.fn(async () => ({
        content: 'shown',
        images: [
          { mimeType: 'image/png', url: 'https://cdn.example.test/a.png' },
        ],
        ok: true as const,
      })),
    })
    const runner = createServerAgentRunner({
      socket: fake.socket,
      store: createAgentStore(),
      tools: [bash],
    })

    const done = runner.run(input)
    await flush()
    const runId = fake.requested[0].payload.runId
    fake.deliver('agent.tool.call', {
      runId,
      toolCallId: 'c1',
      name: 'bash',
      arguments: { command: 'view /embeds/a.png' },
    })
    await flush()

    expect(fake.requested).toContainEqual({
      event: 'agent.tool.result',
      payload: expect.objectContaining({
        images: [
          { mimeType: 'image/png', url: 'https://cdn.example.test/a.png' },
        ],
        toolCallId: 'c1',
      }),
    })
    fake.deliver('agent.done', { runId, status: 'complete' })
    await done
  })

  it('marks a server tool row from its result event without running anything locally', async () => {
    const fake = createFakeSocket()
    const store = createAgentStore()
    const bash = tool()
    const runner = createServerAgentRunner({
      socket: fake.socket,
      store,
      tools: [bash],
    })

    const done = runner.run(input)
    await flush()
    const runId = fake.requested[0].payload.runId
    fake.deliver('agent.event', {
      runId,
      event: {
        type: 'toolcall_end',
        contentIndex: 0,
        toolCall: {
          id: 's1',
          name: 'search_articles',
          arguments: { keyword: 'rust' },
        },
      },
    })
    fake.deliver('agent.event', {
      runId,
      event: {
        type: 'tool_result',
        toolCallId: 's1',
        name: 'search_articles',
        content: '- type=post id=p1',
        isError: false,
      },
    })
    fake.deliver('agent.done', { runId, status: 'complete' })
    await done

    expect(bash.execute).not.toHaveBeenCalled()
    const group = store
      .getState()
      .bubbles.find((b) => b.type === 'tool_call_group')
    expect(group).toMatchObject({
      items: [
        {
          id: 's1',
          result: '- type=post id=p1',
          status: 'completed',
          toolName: 'search_articles',
        },
      ],
    })
  })

  it('reports document operations returned by client tools', async () => {
    const fake = createFakeSocket()
    const store = createAgentStore()
    const ops = [{ blockId: 'a', op: 'delete' } as unknown as AgentOperation]
    const onOperationsChanged = vi.fn()
    const runner = createServerAgentRunner({
      onOperationsChanged,
      socket: fake.socket,
      store,
      tools: [
        tool({
          execute: async () => ({
            content: '',
            ok: true as const,
            operations: ops,
            operationsMode: 'replace' as const,
          }),
        }),
      ],
    })

    const done = runner.run(input)
    await flush()
    const runId = fake.requested[0].payload.runId
    fake.deliver('agent.tool.call', {
      runId,
      toolCallId: 'c1',
      name: 'bash',
      arguments: {},
    })
    await flush()
    fake.deliver('agent.done', { runId, status: 'complete' })
    await done

    expect(onOperationsChanged).toHaveBeenCalledWith(ops, 'c1')
  })

  it('fails the run and cancels it when a tool result cannot be delivered', async () => {
    const fake = createFakeSocket(undefined, {
      'agent.tool.result': { code: 'TIMEOUT', ok: false },
    })
    const runner = createServerAgentRunner({
      socket: fake.socket,
      store: createAgentStore(),
      tools: [tool()],
    })

    const done = runner.run(input)
    await flush()
    const runId = fake.requested[0].payload.runId
    fake.deliver('agent.tool.call', {
      runId,
      toolCallId: 'c1',
      name: 'bash',
      arguments: {},
    })

    await expect(done).resolves.toMatchObject({ runId, status: 'failed' })
    expect(fake.sent).toContainEqual({
      event: 'agent.cancel',
      payload: { runId },
    })
  })

  it('ignores a tool result the server no longer waits for', async () => {
    const fake = createFakeSocket(undefined, {
      'agent.tool.result': { code: 'UNKNOWN_TOOL_CALL', ok: false },
    })
    const runner = createServerAgentRunner({
      socket: fake.socket,
      store: createAgentStore(),
      tools: [tool()],
    })

    const done = runner.run(input)
    await flush()
    const runId = fake.requested[0].payload.runId
    fake.deliver('agent.tool.call', {
      runId,
      toolCallId: 'c1',
      name: 'bash',
      arguments: {},
    })
    await flush()
    expect(fake.sent).toEqual([])
    fake.deliver('agent.done', { runId, status: 'complete' })
    await expect(done).resolves.toMatchObject({ status: 'complete' })
  })

  it('answers an unknown client tool with an error', async () => {
    const fake = createFakeSocket()
    const runner = createServerAgentRunner({
      socket: fake.socket,
      store: createAgentStore(),
      tools: [],
    })

    const done = runner.run(input)
    await flush()
    const runId = fake.requested[0].payload.runId
    fake.deliver('agent.tool.call', {
      runId,
      toolCallId: 'c9',
      name: 'nope',
      arguments: {},
    })
    await flush()
    fake.deliver('agent.done', { runId, status: 'complete' })
    await done

    expect(
      fake.requested.find((r) => r.event === 'agent.tool.result')!.payload,
    ).toMatchObject({
      isError: true,
      toolCallId: 'c9',
    })
  })

  it('cancels the server run when aborted', async () => {
    const fake = createFakeSocket()
    const controller = new AbortController()
    const runner = createServerAgentRunner({
      socket: fake.socket,
      store: createAgentStore(),
      tools: [],
    })

    const done = runner.run(input, controller.signal)
    await flush()
    const runId = fake.requested[0].payload.runId
    controller.abort()

    expect(fake.sent).toContainEqual({
      event: 'agent.cancel',
      payload: { runId },
    })
    fake.deliver('agent.done', { runId, status: 'aborted' })
    await expect(done).resolves.toMatchObject({ status: 'aborted' })
  })

  it('does not start the server run when aborted before it was sent', async () => {
    const fake = createFakeSocket()
    const controller = new AbortController()
    const runner = createServerAgentRunner({
      socket: fake.socket,
      store: createAgentStore(),
      tools: [],
    })

    const done = runner.run(input, controller.signal)
    controller.abort()

    await expect(done).rejects.toMatchObject({ name: 'AbortError' })
    expect(fake.requested.filter((r) => r.event === 'agent.run')).toEqual([])
  })

  it('ignores frames that belong to another run', async () => {
    const fake = createFakeSocket()
    const store = createAgentStore()
    const runner = createServerAgentRunner({
      socket: fake.socket,
      store,
      tools: [],
    })

    const done = runner.run(input)
    await flush()
    const runId = fake.requested[0].payload.runId
    fake.deliver('agent.event', {
      runId: 'other',
      event: { type: 'text_delta', contentIndex: 0, delta: 'x' },
    })
    fake.deliver('agent.done', { runId, status: 'complete' })
    await done

    expect(store.getState().bubbles).toEqual([])
  })

  it('rejects when the server refuses the run', async () => {
    const fake = createFakeSocket({ code: 'AGENT_BUSY', ok: false })
    const runner = createServerAgentRunner({
      socket: fake.socket,
      store: createAgentStore(),
      tools: [],
    })

    await expect(runner.run(input)).rejects.toThrow()
  })

  it('fails the run when the socket drops before the server finishes', async () => {
    const fake = createFakeSocket()
    const store = createAgentStore()
    const runner = createServerAgentRunner({
      connectionLostMessage: 'lost',
      socket: fake.socket,
      store,
      tools: [],
    })

    const done = runner.run(input)
    await flush()
    const runId = fake.requested[0].payload.runId
    fake.deliver('agent.event', {
      runId,
      event: { type: 'text_delta', contentIndex: 0, delta: 'partial' },
    })
    fake.deliver('$state', 'reconnecting')

    await expect(done).resolves.toEqual({
      error: 'lost',
      runId,
      status: 'failed',
    })
    expect(store.getState().bubbles).toEqual([
      { content: 'partial', streaming: false, type: 'assistant' },
    ])
  })

  it('settles as aborted when the server never confirms a cancel', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const fake = createFakeSocket()
      const controller = new AbortController()
      const runner = createServerAgentRunner({
        socket: fake.socket,
        store: createAgentStore(),
        tools: [],
      })

      const done = runner.run(input, controller.signal)
      await flush()
      const runId = fake.requested[0].payload.runId
      controller.abort()
      await vi.advanceTimersByTimeAsync(10_000)

      await expect(done).resolves.toEqual({ runId, status: 'aborted' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps a user bubble added mid-stream and continues the assistant bubble above it', async () => {
    const fake = createFakeSocket()
    const store = createAgentStore()
    const runner = createServerAgentRunner({
      socket: fake.socket,
      store,
      tools: [],
    })

    const done = runner.run(input)
    await flush()
    const runId = fake.requested[0].payload.runId
    fake.deliver('agent.event', {
      runId,
      event: { type: 'thinking_delta', contentIndex: 0, delta: 'hmm' },
    })
    fake.deliver('agent.event', {
      runId,
      event: { type: 'text_delta', contentIndex: 1, delta: 'Work' },
    })
    store.getState().addBubble({ content: 'shorter please', type: 'user' })
    fake.deliver('agent.event', {
      runId,
      event: { type: 'text_delta', contentIndex: 1, delta: 'ing' },
    })
    fake.deliver('agent.event', { runId, event: { type: 'done', message: {} } })
    fake.deliver('agent.event', {
      runId,
      event: { type: 'text_delta', contentIndex: 0, delta: 'Shorter' },
    })
    fake.deliver('agent.done', { runId, status: 'complete' })
    await done

    expect(
      store
        .getState()
        .bubbles.map((bubble) =>
          bubble.type === 'thinking'
            ? 'thinking'
            : `${bubble.type}:${'content' in bubble ? bubble.content : ''}`,
        ),
    ).toEqual([
      'thinking',
      'assistant:Working',
      'user:shorter please',
      'assistant:Shorter',
    ])
  })

  it('steers the active run with the message and the current files', async () => {
    const fake = createFakeSocket()
    const runner = createServerAgentRunner({
      socket: fake.socket,
      store: createAgentStore(),
      tools: [],
    })

    const done = runner.run(input)
    await flush()
    const runId = fake.requested[0].payload.runId
    const files = [{ content: '<doc/>', path: '/doc.xml' }]

    await expect(runner.steer('shorter please', files)).resolves.toBe(true)
    expect(fake.requested[1]).toEqual({
      event: 'agent.steer',
      payload: { files, runId, user: 'shorter please' },
    })

    fake.deliver('agent.done', { runId, status: 'complete' })
    await done
    await expect(runner.steer('late', [])).resolves.toBe(false)
  })

  it('reports a steer the server refused', async () => {
    const fake = createFakeSocket(
      { ok: true },
      { 'agent.steer': { code: 'RUN_ENDED', ok: false } },
    )
    const runner = createServerAgentRunner({
      socket: fake.socket,
      store: createAgentStore(),
      tools: [],
    })

    const done = runner.run(input)
    await flush()
    const runId = fake.requested[0].payload.runId

    await expect(runner.steer('too late', [])).resolves.toBe(false)

    fake.deliver('agent.done', { runId, status: 'complete' })
    await done
  })

  it('attaches the turn usage to the last assistant reply of the run', async () => {
    const fake = createFakeSocket()
    const store = createAgentStore()
    const runner = createServerAgentRunner({
      socket: fake.socket,
      store,
      tools: [],
    })
    const usage = (
      input: number,
      cacheRead: number,
      output: number,
      total: number,
    ) => ({
      cacheRead,
      cacheWrite: 0,
      cost: { total },
      input,
      output,
    })

    const done = runner.run(input)
    await flush()
    const runId = fake.requested[0].payload.runId
    fake.deliver('agent.event', {
      runId,
      event: { type: 'text_delta', contentIndex: 0, delta: 'Looking' },
    })
    fake.deliver('agent.event', {
      runId,
      event: {
        type: 'done',
        message: { usage: usage(1000, 9000, 300, 0.002) },
      },
    })
    fake.deliver('agent.event', {
      runId,
      event: { type: 'text_delta', contentIndex: 0, delta: 'Done' },
    })
    fake.deliver('agent.event', {
      runId,
      event: {
        type: 'done',
        message: { usage: usage(1729, 702, 560, 0.0011) },
      },
    })
    fake.deliver('agent.done', { runId, status: 'complete' })
    await done

    const bubbles = store.getState().bubbles
    expect(bubbles[0]).not.toHaveProperty('usage')
    expect(bubbles[1]).toMatchObject({
      content: 'Done',
      type: 'assistant',
      usage: {
        cacheRead: 9702,
        cacheWrite: 0,
        calls: 2,
        cost: 0.0031,
        input: 2729,
        output: 860,
      },
    })
  })

  describe('wire protocol', () => {
    const v1 = '<doc>\n  <p>one</p>\n</doc>'
    const v2 = '<doc>\n  <p>two</p>\n</doc>'

    async function finishRun(
      fake: ReturnType<typeof createFakeSocket>,
      done: Promise<unknown>,
    ) {
      await flush()
      const runId = fake.requested.findLast((r) => r.event === 'agent.run')!
        .payload.runId
      fake.deliver('agent.done', { runId, status: 'complete' })
      await done
    }

    it('sends hashes and patches on a later run of the same conversation', async () => {
      const fake = createFakeSocket()
      const runner = createServerAgentRunner({
        socket: fake.socket,
        store: createAgentStore(),
        tools: [tool()],
        wire: createAgentWireClient(),
      })

      await finishRun(
        fake,
        runner.run({ ...input, files: [{ content: v1, path: '/doc.xml' }] }),
      )
      await finishRun(
        fake,
        runner.run({ ...input, files: [{ content: v2, path: '/doc.xml' }] }),
      )

      const second = fake.requested.filter((r) => r.event === 'agent.run')[1]
        .payload
      expect(second.system).toBeUndefined()
      expect(second.tools).toBeUndefined()
      expect(second.systemHash).toMatch(/^[\da-f]{64}$/)
      expect(applyFilePatch(v1, second.files[0].patch)).toBe(v2)
    })

    it('resends full context once when the server reports it missing', async () => {
      const fake = createFakeSocket(undefined, {
        'agent.run': [
          { ok: true, conversationId: 'conv-1' },
          { code: 'CONTEXT_MISSING', missing: ['system'], ok: false },
          { ok: true, conversationId: 'conv-1' },
        ],
      })
      const runner = createServerAgentRunner({
        socket: fake.socket,
        store: createAgentStore(),
        tools: [],
        wire: createAgentWireClient(),
      })

      await finishRun(fake, runner.run(input))
      await finishRun(fake, runner.run(input))

      const runs = fake.requested.filter((r) => r.event === 'agent.run')
      expect(runs).toHaveLength(3)
      expect(runs[1].payload.system).toBeUndefined()
      expect(runs[2].payload.system).toEqual(['sys'])
    })

    it('resends full files once when the server baseline does not match', async () => {
      const fake = createFakeSocket(undefined, {
        'agent.run': [
          { ok: true, conversationId: 'conv-1' },
          { code: 'FILE_BASE_MISMATCH', ok: false, paths: ['/doc.xml'] },
          { ok: true, conversationId: 'conv-1' },
        ],
      })
      const runner = createServerAgentRunner({
        socket: fake.socket,
        store: createAgentStore(),
        tools: [],
        wire: createAgentWireClient(),
      })

      await finishRun(
        fake,
        runner.run({ ...input, files: [{ content: v1, path: '/doc.xml' }] }),
      )
      await finishRun(
        fake,
        runner.run({ ...input, files: [{ content: v2, path: '/doc.xml' }] }),
      )

      const runs = fake.requested.filter((r) => r.event === 'agent.run')
      expect(runs[1].payload.files[0]).toHaveProperty('patch')
      expect(runs[2].payload.files).toEqual([{ content: v2, path: '/doc.xml' }])
    })

    it('reports the conversation id the server assigned and keys files under it', async () => {
      const fake = createFakeSocket({ ok: true, conversationId: 'conv-9' })
      const onConversation = vi.fn()
      let touched = v1
      const runner = createServerAgentRunner({
        collectFiles: () => [{ content: touched, path: '/doc.xml' }],
        onConversation,
        socket: fake.socket,
        store: createAgentStore(),
        tools: [tool()],
        wire: createAgentWireClient(),
      })

      const done = runner.run({
        ...input,
        conversationId: null,
        files: [{ content: v1, path: '/doc.xml' }],
      })
      await flush()
      expect(onConversation).toHaveBeenCalledWith('conv-9')
      const runId = fake.requested[0].payload.runId
      touched = v2
      fake.deliver('agent.tool.call', {
        runId,
        toolCallId: 'c1',
        name: 'bash',
        arguments: {},
      })
      await flush()

      const result = fake.requested.find(
        (r) => r.event === 'agent.tool.result',
      )!.payload
      expect(applyFilePatch(v1, result.files[0].patch)).toBe(v2)
      fake.deliver('agent.done', { runId, status: 'complete' })
      await done
    })

    it('resends a tool result with full files when its baseline does not match', async () => {
      const fake = createFakeSocket(undefined, {
        'agent.tool.result': [
          { code: 'FILE_BASE_MISMATCH', ok: false, paths: ['/doc.xml'] },
          { ok: true },
        ],
      })
      const runner = createServerAgentRunner({
        collectFiles: () => [{ content: v2, path: '/doc.xml' }],
        socket: fake.socket,
        store: createAgentStore(),
        tools: [tool()],
        wire: createAgentWireClient(),
      })

      const done = runner.run({
        ...input,
        files: [{ content: v1, path: '/doc.xml' }],
      })
      await flush()
      const runId = fake.requested[0].payload.runId
      fake.deliver('agent.tool.call', {
        runId,
        toolCallId: 'c1',
        name: 'bash',
        arguments: {},
      })
      await flush()
      await flush()

      const results = fake.requested.filter(
        (r) => r.event === 'agent.tool.result',
      )
      expect(results).toHaveLength(2)
      expect(results[1].payload.files).toEqual([
        { content: v2, path: '/doc.xml' },
      ])
      fake.deliver('agent.done', { runId, status: 'complete' })
      await done
    })
  })
})
