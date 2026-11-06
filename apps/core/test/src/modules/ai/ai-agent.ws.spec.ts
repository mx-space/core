import {
  type AgentToolSchema,
  AgentWsEvents,
  createFilePatch,
  hashAgentText,
  hashAgentValue,
  type ResolvedAgentRun,
} from '@mx-space/ai'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AiAgentWsHandler } from '~/modules/ai/ai-agent/ai-agent.ws'
import type { AgentRunOptions } from '~/modules/ai/ai-agent/ai-agent-run.service'
import { AdminWsHandlerRegistry } from '~/processors/gateway/admin/admin-ws-handler.registry'

const system = ['You edit documents.']
const tools: AgentToolSchema[] = [
  { name: 'bash', description: 'Run bash', parameters: { type: 'object' } },
]
const doc1 = '<doc>\n  <p>one</p>\n</doc>'
const doc2 = '<doc>\n  <p>two</p>\n</doc>'

function setup() {
  const registry = new AdminWsHandlerRegistry()
  const runs: Array<{ request: ResolvedAgentRun; options: AgentRunOptions }> =
    []
  const finishers: Array<() => void> = []
  const runService = {
    run: vi.fn(
      (request: ResolvedAgentRun, options: AgentRunOptions) =>
        new Promise((resolve) => {
          runs.push({ request, options })
          finishers.push(() => resolve({ status: 'complete' }))
        }),
    ),
  }
  const redis = {
    getClient: () => ({
      set: vi.fn(async () => 'OK'),
      eval: vi.fn(async () => 1),
    }),
  }
  let nextId = 100
  const repository = {
    create: vi.fn(async (input: { sessionId: string }) => ({
      id: String(nextId++),
      ...input,
    })),
  }
  const handler = new AiAgentWsHandler(
    registry,
    runService as any,
    redis as any,
    repository as any,
  )
  handler.onModuleInit()
  const sent: Array<{ event: string; payload: any }> = []
  const ctx = {
    alive: () => true,
    connectionId: 'conn-1',
    join: async () => {},
    leave: async () => {},
    send: (event: string, payload: unknown) => sent.push({ event, payload }),
  }
  const dispatch = (event: string, payload: unknown) =>
    registry.dispatch(event, ctx, payload)
  return {
    handler,
    dispatch,
    runs,
    sent,
    repository,
    finishAll: async () => {
      for (const finish of finishers.splice(0)) finish()
      await new Promise((resolve) => setTimeout(resolve, 0))
    },
  }
}

async function runPayload(overrides: Record<string, unknown> = {}) {
  return {
    runId: 'run-1',
    sessionId: 'post:1',
    conversationId: null,
    model: 'm',
    providerId: 'p',
    user: 'hello',
    systemHash: await hashAgentValue(system),
    system,
    toolsHash: await hashAgentValue(tools),
    tools,
    files: [{ path: '/doc.xml', content: doc1 }],
    ...overrides,
  }
}

const torn: Array<() => void> = []
afterEach(() => {
  while (torn.length) torn.pop()!()
})

describe('AiAgentWsHandler', () => {
  it('creates a conversation for a run without one and acks its id', async () => {
    const t = setup()
    torn.push(() => t.handler.onModuleDestroy())

    const ack = await t.dispatch(AgentWsEvents.run, await runPayload())

    expect(ack).toEqual({ ok: true, conversationId: '100' })
    expect(t.repository.create).toHaveBeenCalledWith({
      sessionId: 'post:1',
      model: 'm',
      providerId: 'p',
    })
    expect(t.runs[0].request).toMatchObject({
      conversationId: '100',
      system,
      tools,
      files: [{ path: '/doc.xml', content: doc1 }],
    })
  })

  it('resolves hash-only context and patched files on a later run', async () => {
    const t = setup()
    torn.push(() => t.handler.onModuleDestroy())
    await t.dispatch(AgentWsEvents.run, await runPayload())
    await t.finishAll()

    const ack = await t.dispatch(
      AgentWsEvents.run,
      await runPayload({
        runId: 'run-2',
        conversationId: '100',
        system: undefined,
        tools: undefined,
        files: [
          {
            path: '/doc.xml',
            baseHash: await hashAgentText(doc1),
            patch: createFilePatch(doc1, doc2),
          },
        ],
      }),
    )

    expect(ack).toEqual({ ok: true, conversationId: '100' })
    expect(t.runs[1].request).toMatchObject({
      system,
      tools,
      files: [{ path: '/doc.xml', content: doc2 }],
    })
  })

  it('asks for missing context instead of starting the run', async () => {
    const t = setup()
    torn.push(() => t.handler.onModuleDestroy())

    const ack = await t.dispatch(
      AgentWsEvents.run,
      await runPayload({ system: undefined }),
    )

    expect(ack).toEqual({
      ok: false,
      code: 'CONTEXT_MISSING',
      missing: ['system'],
    })
    expect(t.runs).toHaveLength(0)
    expect(t.repository.create).not.toHaveBeenCalled()
  })

  it('accepts tools hashed in the key order the admin client builds them', async () => {
    const t = setup()
    torn.push(() => t.handler.onModuleDestroy())
    const clientTools = [
      { description: 'Run bash', name: 'bash', parameters: { type: 'object' } },
    ]

    const ack = await t.dispatch(
      AgentWsEvents.run,
      await runPayload({
        tools: clientTools,
        toolsHash: await hashAgentValue(clientTools),
      }),
    )

    expect(ack).toEqual({ ok: true, conversationId: '100' })
  })

  it('refuses a second run for the same session while the first is being set up', async () => {
    const t = setup()
    torn.push(() => t.handler.onModuleDestroy())

    t.repository.create.mockImplementation(
      (input: { sessionId: string }) =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ id: '100', ...input }), 20),
        ),
    )
    const payloads = [await runPayload(), await runPayload({ runId: 'run-2' })]
    const [first, second] = await Promise.all(
      payloads.map((payload) => t.dispatch(AgentWsEvents.run, payload)),
    )

    expect([first, second]).toContainEqual({ ok: false, code: 'AGENT_BUSY' })
    expect(t.repository.create).toHaveBeenCalledTimes(1)
  })

  it('rejects the legacy payload shape', async () => {
    const t = setup()
    torn.push(() => t.handler.onModuleDestroy())
    const { systemHash: _s, toolsHash: _t, ...legacy } = await runPayload()

    expect(await t.dispatch(AgentWsEvents.run, legacy)).toEqual({
      ok: false,
      code: 'VALIDATION_FAILED',
    })
  })

  it('delivers patched tool-result files to the waiting run', async () => {
    const t = setup()
    torn.push(() => t.handler.onModuleDestroy())
    await t.dispatch(AgentWsEvents.run, await runPayload())
    const pending = t.runs[0].options.sink.callClientTool({
      toolCallId: 'call-1',
      name: 'bash',
      arguments: {},
    })

    const ack = await t.dispatch(AgentWsEvents.toolResult, {
      runId: 'run-1',
      toolCallId: 'call-1',
      content: 'ok',
      isError: false,
      files: [
        {
          path: '/doc.xml',
          baseHash: await hashAgentText(doc1),
          patch: createFilePatch(doc1, doc2),
        },
      ],
    })

    expect(ack).toEqual({ ok: true })
    await expect(pending).resolves.toEqual({
      toolCallId: 'call-1',
      content: 'ok',
      isError: false,
      files: [{ path: '/doc.xml', content: doc2 }],
    })
  })

  it('keeps a tool call waiting when its files do not match the baseline', async () => {
    const t = setup()
    torn.push(() => t.handler.onModuleDestroy())
    await t.dispatch(AgentWsEvents.run, await runPayload())
    void t.runs[0].options.sink
      .callClientTool({ toolCallId: 'call-1', name: 'bash', arguments: {} })
      .catch(() => {})

    const stale = {
      runId: 'run-1',
      toolCallId: 'call-1',
      content: 'ok',
      isError: false,
      files: [{ path: '/doc.xml', hash: await hashAgentText(doc2) }],
    }
    expect(await t.dispatch(AgentWsEvents.toolResult, stale)).toEqual({
      ok: false,
      code: 'FILE_BASE_MISMATCH',
      paths: ['/doc.xml'],
    })
    expect(
      await t.dispatch(AgentWsEvents.toolResult, {
        ...stale,
        files: [{ path: '/doc.xml', content: doc2 }],
      }),
    ).toEqual({ ok: true })
  })
})
