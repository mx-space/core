import { fauxAssistantMessage } from '@earendil-works/pi-ai'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { withFauxAi } from '@/helper/faux-ai.helper'
import { createPgRepositoryMock, now } from '@/helper/pg-repository-mock'
import { CollectionRefTypes } from '~/constants/db.constant'
import { AIProviderType } from '~/modules/ai/ai.types'
import type { AiStreamEvent } from '~/modules/ai/ai-inflight/ai-inflight.types'
import type { AiInsightsRepository } from '~/modules/ai/ai-insights/ai-insights.repository'
import { AiInsightsService } from '~/modules/ai/ai-insights/ai-insights.service'
import { PiRuntimeAdapter } from '~/modules/ai/runtime/pi-runtime.adapter'

const PROVIDER = 'faux-insights'
const MODEL_ID = 'faux-insights-model'

function makeRuntime(stopReason: 'stop' | 'error' = 'stop', errMsg?: string) {
  const message =
    stopReason === 'error'
      ? fauxAssistantMessage('ignored', {
          stopReason: 'error',
          errorMessage: errMsg ?? 'boom',
        })
      : fauxAssistantMessage('### Insights\nbullet point body')
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
  const repository = createPgRepositoryMock<AiInsightsRepository>()
  const databaseService = {
    findGlobalById: vi.fn(async () => ({
      id: 'post-1',
      type: CollectionRefTypes.Post,
      document: {
        id: 'post-1',
        title: 'T',
        text: 'source text',
        tags: [],
        lang: 'en',
      },
    })),
    findGlobalByIds: vi.fn(),
  }
  const configService = {
    get: vi.fn(async () => ({ enableInsights: true })),
    waitForConfigReady: vi.fn(async () => ({ ai: { enableInsights: true } })),
  }
  const aiService = {
    getInsightsModel: vi.fn(async () => runtime),
  }
  const inflightEvents: AiStreamEvent[] = []
  const aiInFlightService = {
    runWithStream: vi.fn(async (opts: any) => {
      const events: AiStreamEvent[] = []
      const push = async (event: AiStreamEvent) => {
        events.push(event)
        inflightEvents.push(event)
      }
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
  const aiTaskService = {}
  const eventEmitter = { emit: vi.fn() }

  repository.findByRefAndLang.mockResolvedValue(null)
  repository.deleteTranslationsWithDifferentHash = vi.fn(async () => 0) as any
  repository.upsert.mockImplementation(async (input: any) => ({
    id: 'insights-1',
    refId: input.refId,
    lang: input.lang,
    content: input.content,
    hash: input.hash,
    isTranslation: false,
    sourceLang: input.sourceLang,
    sourceInsightsId: null,
    createdAt: now,
  }))
  repository.findById.mockResolvedValue({
    id: 'insights-1',
    refId: 'post-1',
    lang: 'en',
    content: '### Insights\nbullet point body',
    hash: 'h',
    isTranslation: false,
    sourceLang: 'en',
    sourceInsightsId: null,
    createdAt: now,
  })

  const service = new AiInsightsService(
    repository as any,
    databaseService as any,
    configService as any,
    aiService as any,
    aiInFlightService as any,
    taskProcessor as any,
    aiTaskService as any,
    eventEmitter as any,
  )
  return { service, inflightEvents }
}

function renderSse(events: AiStreamEvent[]): string {
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

describe('ai-insights faux e2e', () => {
  it('streams happy path; incrementTokens callback fires once', async () => {
    const r = makeRuntime()
    torn.push(r.teardown)
    const { service, inflightEvents } = createService(r.adapter)

    const onToken = vi.fn(async () => {})
    const result = await service.generateInsights('post-1', onToken)

    expect(result).toBeDefined()
    expect(onToken).toHaveBeenCalledTimes(1)

    const sse = renderSse(inflightEvents)
    expect(sse.endsWith('event: done\n\n')).toBe(true)
    expect(/event: token\ndata: [^\n]+\n\n/.test(sse)).toBe(true)
  })

  it('surfaces pi error path as thrown', async () => {
    const r = makeRuntime('error', 'pipeline failed')
    torn.push(r.teardown)
    const { service } = createService(r.adapter)
    await expect(service.generateInsights('post-1')).rejects.toThrow(
      /pipeline failed/,
    )
  })
})
