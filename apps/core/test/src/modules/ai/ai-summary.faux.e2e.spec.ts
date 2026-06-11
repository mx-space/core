import { fauxAssistantMessage } from '@earendil-works/pi-ai'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { withFauxAi } from '@/helper/faux-ai.helper'
import { createPgRepositoryMock, now } from '@/helper/pg-repository-mock'
import { CollectionRefTypes } from '~/constants/db.constant'
import { AIProviderType } from '~/modules/ai/ai.types'
import type { AiStreamEvent } from '~/modules/ai/ai-inflight/ai-inflight.types'
import type { AiSummaryRepository } from '~/modules/ai/ai-summary/ai-summary.repository'
import { AiSummaryService } from '~/modules/ai/ai-summary/ai-summary.service'
import { PiRuntimeAdapter } from '~/modules/ai/runtime/pi-runtime.adapter'

const PROVIDER = 'faux-summary'
const MODEL_ID = 'faux-summary-model'

interface InflightCall {
  push: (event: AiStreamEvent) => Promise<void>
}

function makeRuntime(stopReason: 'stop' | 'error' = 'stop', errMsg?: string) {
  const message =
    stopReason === 'error'
      ? fauxAssistantMessage('ignored', {
          stopReason: 'error',
          errorMessage: errMsg ?? 'boom',
        })
      : fauxAssistantMessage(JSON.stringify({ summary: 'hello world' }))
  const handle = withFauxAi({
    api: 'openai-completions',
    provider: PROVIDER,
    models: [{ id: MODEL_ID, name: MODEL_ID }],
    responses: [message],
  })
  const adapter = new PiRuntimeAdapter({
    apiKey: 'k',
    endpoint: `https://${PROVIDER}.example.com`,
    model: MODEL_ID,
    providerType: AIProviderType.OpenAICompatible,
    providerId: PROVIDER,
  })
  return { adapter, teardown: () => handle.teardown() }
}

function createService(runtime: PiRuntimeAdapter) {
  const repository = createPgRepositoryMock<AiSummaryRepository>()
  const databaseService = {
    findGlobalById: vi.fn(async () => ({
      id: 'post-1',
      type: CollectionRefTypes.Post,
      document: {
        id: 'post-1',
        text: 'source text',
        title: 'Title',
        isPublished: true,
      },
    })),
    findGlobalByIds: vi.fn(),
  }
  const configService = {
    get: vi.fn(async () => ({ enableSummary: true })),
    waitForConfigReady: vi.fn(async () => ({ ai: { enableSummary: true } })),
  }
  const aiService = {
    getSummaryModel: vi.fn(async () => runtime),
  }
  let lastInflight: InflightCall | null = null
  const inflightEvents: AiStreamEvent[] = []
  const aiInFlightService = {
    runWithStream: vi.fn(async (opts: any) => {
      const events: AiStreamEvent[] = []
      const push = async (event: AiStreamEvent) => {
        events.push(event)
        inflightEvents.push(event)
      }
      lastInflight = { push }
      const { result, resultId } = await opts.onLeader({ push })
      events.push({ type: 'done', data: { resultId } })
      inflightEvents.push({ type: 'done', data: { resultId } })
      return {
        role: 'leader',
        events: (async function* () {
          for (const ev of events) yield ev
        })(),
        result: Promise.resolve(result),
      }
    }),
  }
  const taskProcessor = { registerHandler: vi.fn() }
  const aiTaskService = { createSummaryTask: vi.fn() }

  repository.findByHash.mockResolvedValue(null)
  repository.upsert.mockImplementation(async (input: any) => ({
    id: 'summary-1',
    refId: input.refId,
    lang: input.lang,
    summary: input.summary,
    hash: input.hash,
    createdAt: now,
  }))
  repository.findById.mockResolvedValue({
    id: 'summary-1',
    refId: 'post-1',
    lang: 'en',
    summary: 'hello world',
    hash: 'h',
    createdAt: now,
  })

  const service = new AiSummaryService(
    repository as any,
    databaseService as any,
    configService as any,
    aiService as any,
    aiInFlightService as any,
    taskProcessor as any,
    aiTaskService as any,
  )
  return {
    service,
    repository,
    inflightEvents,
    get lastInflight() {
      return lastInflight
    },
  }
}

function renderSse(events: AiStreamEvent[]): string {
  // Mirror controller.generateArticleSummary's SSE encoding using sse.util shape.
  let out = ''
  for (const ev of events) {
    if (ev.type === 'token') {
      const payload =
        typeof ev.data === 'string' ? ev.data : JSON.stringify(ev.data ?? null)
      out += `event: token\ndata: ${payload}\n\n`
    } else if (ev.type === 'done') {
      out += `event: done\n\n`
    } else if (ev.type === 'error') {
      out += `event: error\ndata: ${JSON.stringify(ev.data ?? null)}\n\n`
    }
  }
  return out
}

const torn: Array<() => void> = []
afterEach(() => {
  while (torn.length) torn.pop()!()
})

describe('ai-summary faux e2e', () => {
  it('streams happy path with PUBLIC SSE envelope shape + cached-hydrate cleanup', async () => {
    const r = makeRuntime()
    torn.push(r.teardown)
    const { service, inflightEvents } = createService(r.adapter)

    const onToken = vi.fn(async () => {})
    const out = await service.generateSummaryByOpenAI('post-1', 'en', onToken)

    expect(out).toBeDefined()
    // incrementTokens called exactly once
    expect(onToken).toHaveBeenCalledTimes(1)

    const sse = renderSse(inflightEvents)
    // PUBLIC envelope assertions
    expect(sse.endsWith('event: done\n\n')).toBe(true)
    // each token frame conforms to byte shape
    const tokenFrames = sse.match(/event: token\ndata: [^\n]+\n\n/g) ?? []
    expect(tokenFrames.length).toBeGreaterThan(0)
    // tokens concatenate to the model JSON (which is then parsed by service)
    const tokensConcat = inflightEvents
      .filter((e) => e.type === 'token')
      .map((e) => (e as { type: 'token'; data: string }).data)
      .join('')
    expect(tokensConcat).toBe(JSON.stringify({ summary: 'hello world' }))
  })

  it('surfaces pi error as wire-shaped error frame via thrown Error', async () => {
    const r = makeRuntime('error', 'upstream blew')
    torn.push(r.teardown)
    const { service } = createService(r.adapter)

    await expect(
      service.generateSummaryByOpenAI('post-1', 'en'),
    ).rejects.toThrow(/upstream blew/)
  })
})
