import type { AgentOperation, AgentToolConfig } from '@haklex/rich-agent-core'
import { createAgentStore } from '@haklex/rich-agent-core'
import type { WsAckPayload } from '@mx-space/ws-client'
import { describe, expect, it, vi } from 'vitest'

import {
  type AgentSocketPort,
  createServerAgentRunner,
  type ServerAgentRunInput,
} from './server-agent-runner'

function createFakeSocket(
  ack: WsAckPayload = { ok: true },
  acks: Record<string, WsAckPayload> = {},
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
      const reply = acks[event] ?? ack
      if (!reply.ok) throw Object.assign(new Error('rejected'), reply)
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
  await new Promise((resolve) => setTimeout(resolve, 0))
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
    expect(fake.sent).toContainEqual({
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

    expect(onOperationsChanged).toHaveBeenCalledWith(ops)
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

    expect(fake.sent[0].payload).toMatchObject({
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
    vi.useFakeTimers()
    try {
      const fake = createFakeSocket()
      const controller = new AbortController()
      const runner = createServerAgentRunner({
        socket: fake.socket,
        store: createAgentStore(),
        tools: [],
      })

      const done = runner.run(input, controller.signal)
      await vi.advanceTimersByTimeAsync(0)
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
})
