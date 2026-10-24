import { randomUUID } from 'node:crypto'

import type { AgentRunPayload } from '@mx-space/ai'
import { redisHelper } from 'test/helper/redis-mock.helper'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { BusinessEvents } from '~/constants/business-event.constant'
import { AiAgentWsHandler } from '~/modules/ai/ai-agent/ai-agent.ws'
import type { AgentRunOptions } from '~/modules/ai/ai-agent/ai-agent-run.service'
import { AiAgentRunService } from '~/modules/ai/ai-agent/ai-agent-run.service'

import {
  createGatewayApp,
  type GatewayTestApp,
  WsTestClient,
} from './gateway-e2e.harness'

vi.setConfig({ testTimeout: 15_000 })

type FakeRun = (
  payload: AgentRunPayload,
  options: AgentRunOptions,
) => Promise<{ status: 'complete' | 'aborted' | 'failed'; error?: string }>

const runService = { run: vi.fn<FakeRun>() }

function runPayload(runId: string): AgentRunPayload {
  return {
    runId,
    sessionId: `post:${runId}`,
    conversationId: null,
    model: 'm',
    providerId: 'p',
    system: [],
    user: 'hello',
    tools: [],
    files: [],
  }
}

describe('admin gateway agent.* frames', () => {
  let testApp: GatewayTestApp

  beforeAll(async () => {
    const helper = await redisHelper
    const opts = helper.CacheService.getClient().options
    testApp = await createGatewayApp(
      { port: opts.port as number, host: opts.host as string },
      [AiAgentWsHandler, { provide: AiAgentRunService, useValue: runService }],
    )
  })

  afterAll(async () => {
    await testApp.close()
  })

  async function connectOwner() {
    testApp.authService.getSessionUserFromHeaders.mockResolvedValueOnce({
      user: { id: 'owner-1', role: 'owner' },
      session: { token: `tok-${randomUUID()}` },
    })
    const client = await WsTestClient.connect(testApp.adminUrl(), {
      headers: { cookie: 'better-auth.session=abc' },
    })
    await client.waitFor((e) => e.event === BusinessEvents.GATEWAY_CONNECT)
    return client
  }

  it('drives a client tool round trip and reports completion', async () => {
    runService.run.mockImplementationOnce(async (_payload, { sink }) => {
      sink.emit({ type: 'text_delta', contentIndex: 0, delta: 'hi' })
      const result = await sink.callClientTool({
        toolCallId: 'call-1',
        name: 'bash',
        arguments: { command: 'ls' },
      })
      sink.emit({ type: 'text_delta', contentIndex: 0, delta: result.content })
      return { status: 'complete' }
    })
    const client = await connectOwner()
    try {
      const ackId = randomUUID()
      client.send('agent.run', runPayload('r1'), ackId)
      expect((await client.waitForAck(ackId)).payload).toMatchObject({
        ok: true,
      })

      const call = await client.waitFor((e) => e.event === 'agent.tool.call')
      expect(call.payload).toEqual({
        runId: 'r1',
        toolCallId: 'call-1',
        name: 'bash',
        arguments: { command: 'ls' },
      })
      client.send('agent.tool.result', {
        runId: 'r1',
        toolCallId: 'call-1',
        content: 'doc.xml',
        isError: false,
      })

      const done = await client.waitFor((e) => e.event === 'agent.done')
      expect(done.payload).toEqual({ runId: 'r1', status: 'complete' })
      const deltas = client.frames
        .filter((e) => e.event === 'agent.event')
        .map((e) => (e.payload as any).event.delta)
      expect(deltas).toEqual(['hi', 'doc.xml'])
    } finally {
      await client.closeAndWait()
    }
  })

  it('rejects a second run for the same session while one is active', async () => {
    let release!: () => void
    runService.run.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ status: 'complete' })
        }),
    )
    const client = await connectOwner()
    try {
      const first = randomUUID()
      client.send('agent.run', runPayload('r2'), first)
      await client.waitForAck(first)
      const second = randomUUID()
      client.send(
        'agent.run',
        { ...runPayload('r3'), sessionId: 'post:r2' },
        second,
      )
      expect((await client.waitForAck(second)).payload).toMatchObject({
        ok: false,
        code: 'AGENT_BUSY',
      })
      release()
      await client.waitFor((e) => e.event === 'agent.done')
    } finally {
      await client.closeAndWait()
    }
  })

  it('aborts the run when the client cancels', async () => {
    let seenSignal: AbortSignal | undefined
    runService.run.mockImplementationOnce(async (_payload, { signal }) => {
      seenSignal = signal
      await new Promise((resolve) =>
        signal.addEventListener('abort', resolve, { once: true }),
      )
      return { status: 'aborted' }
    })
    const client = await connectOwner()
    try {
      const ackId = randomUUID()
      client.send('agent.run', runPayload('r4'), ackId)
      await client.waitForAck(ackId)
      client.send('agent.cancel', { runId: 'r4' })
      const done = await client.waitFor((e) => e.event === 'agent.done')
      expect(done.payload).toEqual({ runId: 'r4', status: 'aborted' })
      expect(seenSignal?.aborted).toBe(true)
    } finally {
      await client.closeAndWait()
    }
  })

  it('aborts the run when the connection closes', async () => {
    let seenSignal: AbortSignal | undefined
    let finished!: () => void
    const ended = new Promise<void>((resolve) => {
      finished = resolve
    })
    runService.run.mockImplementationOnce(async (_payload, { signal }) => {
      seenSignal = signal
      await new Promise((resolve) =>
        signal.addEventListener('abort', resolve, { once: true }),
      )
      finished()
      return { status: 'aborted' }
    })
    const client = await connectOwner()
    const ackId = randomUUID()
    client.send('agent.run', runPayload('r5'), ackId)
    await client.waitForAck(ackId)
    await client.closeAndWait()
    await ended
    expect(seenSignal?.aborted).toBe(true)
  })

  it('reports a run that throws as failed', async () => {
    runService.run.mockImplementationOnce(async () => {
      throw new Error('provider missing')
    })
    const client = await connectOwner()
    try {
      const ackId = randomUUID()
      client.send('agent.run', runPayload('r6'), ackId)
      await client.waitForAck(ackId)
      const done = await client.waitFor((e) => e.event === 'agent.done')
      expect(done.payload).toEqual({
        runId: 'r6',
        status: 'failed',
        error: 'provider missing',
      })
    } finally {
      await client.closeAndWait()
    }
  })

  it('rejects a run on a conversation another connection is already running', async () => {
    let release!: () => void
    runService.run.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ status: 'complete' })
        }),
    )
    runService.run.mockImplementationOnce(async () => ({ status: 'complete' }))
    const first = await connectOwner()
    const second = await connectOwner()
    const conversationId = `conv-${randomUUID()}`
    try {
      const a = randomUUID()
      first.send('agent.run', { ...runPayload('r7'), conversationId }, a)
      expect((await first.waitForAck(a)).payload).toMatchObject({ ok: true })

      const b = randomUUID()
      second.send('agent.run', { ...runPayload('r8'), conversationId }, b)
      expect((await second.waitForAck(b)).payload).toMatchObject({
        ok: false,
        code: 'AGENT_BUSY',
      })

      release()
      await first.waitFor((e) => e.event === 'agent.done')
      const c = randomUUID()
      second.send('agent.run', { ...runPayload('r9'), conversationId }, c)
      expect((await second.waitForAck(c)).payload).toMatchObject({ ok: true })
      await second.waitFor((e) => e.event === 'agent.done')
    } finally {
      await first.closeAndWait()
      await second.closeAndWait()
    }
  })

  it('queues a steer for an active run and rejects it once the run ended', async () => {
    let release!: () => void
    let steered: Array<{ user: string }> = []
    runService.run.mockImplementationOnce(
      (_payload, { inbox }) =>
        new Promise((resolve) => {
          release = () => {
            steered = inbox!.take()
            resolve({ status: 'complete' })
          }
        }),
    )
    const client = await connectOwner()
    try {
      const runAck = randomUUID()
      client.send('agent.run', runPayload('r10'), runAck)
      expect((await client.waitForAck(runAck)).payload).toMatchObject({
        ok: true,
      })

      const steerAck = randomUUID()
      client.send(
        'agent.steer',
        { runId: 'r10', user: 'shorter please', files: [] },
        steerAck,
      )
      expect((await client.waitForAck(steerAck)).payload).toMatchObject({
        ok: true,
      })

      release()
      await client.waitFor((e) => e.event === 'agent.done')
      expect(steered).toEqual([{ user: 'shorter please', files: [] }])

      const lateAck = randomUUID()
      client.send(
        'agent.steer',
        { runId: 'r10', user: 'too late', files: [] },
        lateAck,
      )
      expect((await client.waitForAck(lateAck)).payload).toMatchObject({
        ok: false,
        code: 'RUN_ENDED',
      })
    } finally {
      await client.closeAndWait()
    }
  })
})
