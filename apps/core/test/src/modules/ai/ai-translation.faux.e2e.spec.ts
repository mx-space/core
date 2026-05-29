import { fauxAssistantMessage } from '@earendil-works/pi-ai'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { withFauxAi } from '@/helper/faux-ai.helper'
import { AIProviderType } from '~/modules/ai/ai.types'
import type { AiStreamEvent } from '~/modules/ai/ai-inflight/ai-inflight.types'
import type { ArticleContent } from '~/modules/ai/ai-translation/ai-translation.types'
import { MarkdownTranslationStrategy } from '~/modules/ai/ai-translation/strategies/markdown-translation.strategy'
import { PiRuntimeAdapter } from '~/modules/ai/runtime/pi-runtime.adapter'

const PROVIDER = 'faux-translation'
const MODEL_ID = 'faux-translation-model'

function makeRuntime(stopReason: 'stop' | 'error' = 'stop', errMsg?: string) {
  const payload = {
    sourceLang: 'en',
    title: 'Translated Title',
    text: 'Translated body text.',
    subtitle: null,
    summary: null,
    tags: [],
  }
  const message =
    stopReason === 'error'
      ? fauxAssistantMessage('ignored', {
          stopReason: 'error',
          errorMessage: errMsg ?? 'translation upstream broke',
        })
      : fauxAssistantMessage(JSON.stringify(payload))
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

const SOURCE: ArticleContent = {
  title: 'Original Title',
  text: 'Original body text.',
  subtitle: null,
  summary: null,
  tags: [],
}

function renderSse(events: AiStreamEvent[]): string {
  let out = ''
  for (const ev of events) {
    if (ev.type === 'token') {
      const payload =
        typeof ev.data === 'string' ? ev.data : JSON.stringify(ev.data ?? null)
      out += `event: token\ndata: ${payload}\n\n`
    } else if (ev.type === 'done') {
      out += 'event: done\n\n'
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

describe('ai-translation faux e2e (markdown strategy)', () => {
  it('streams happy path; emits tokens; onToken called once', async () => {
    const r = makeRuntime()
    torn.push(r.teardown)
    const events: AiStreamEvent[] = []
    const push = vi.fn(async (event: AiStreamEvent) => {
      events.push(event)
    })
    const onToken = vi.fn(async () => {})

    const reviewerService = { callReviewer: vi.fn() }
    const strategy = new MarkdownTranslationStrategy(reviewerService as any)

    const result = await strategy.translate(
      SOURCE,
      'zh',
      r.adapter,
      { model: MODEL_ID, provider: PROVIDER },
      { push, onToken },
    )

    expect(result.title).toBe('Translated Title')
    expect(result.text).toBe('Translated body text.')
    expect(result.sourceLang).toBe('en')
    expect(onToken).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalled()

    events.push({ type: 'done', data: { resultId: 'tx-1' } })
    const sse = renderSse(events)
    expect(sse.endsWith('event: done\n\n')).toBe(true)
    expect(/event: token\ndata: [^\n]+\n\n/.test(sse)).toBe(true)
  })

  it('surfaces pi error event as thrown Error', async () => {
    const r = makeRuntime('error', 'translation upstream broke')
    torn.push(r.teardown)
    const reviewerService = { callReviewer: vi.fn() }
    const strategy = new MarkdownTranslationStrategy(reviewerService as any)
    await expect(
      strategy.translate(
        SOURCE,
        'zh',
        r.adapter,
        { model: MODEL_ID, provider: PROVIDER },
        {},
      ),
    ).rejects.toThrow(/translation upstream broke/)
  })

  it('normalizeChunkTranslationResponse path: parses model JSON correctly', async () => {
    // Wrap the JSON in markdown code fences to exercise the candidate-fence path.
    const handle = withFauxAi({
      api: 'openai-completions',
      provider: PROVIDER,
      models: [{ id: MODEL_ID, name: MODEL_ID }],
      responses: [
        fauxAssistantMessage(
          '```json\n' +
            JSON.stringify({
              sourceLang: 'en',
              title: 'Fenced',
              text: 'Fenced body',
              subtitle: null,
              summary: null,
              tags: [],
            }) +
            '\n```',
        ),
      ],
    })
    torn.push(() => handle.teardown())
    const adapter = new PiRuntimeAdapter({
      apiKey: 'k',
      endpoint: `https://${PROVIDER}.example.com`,
      model: MODEL_ID,
      providerType: AIProviderType.OpenAICompatible,
      providerId: PROVIDER,
    })
    const reviewerService = { callReviewer: vi.fn() }
    const strategy = new MarkdownTranslationStrategy(reviewerService as any)
    const result = await strategy.translate(
      SOURCE,
      'zh',
      adapter,
      { model: MODEL_ID, provider: PROVIDER },
      {},
    )
    expect(result.title).toBe('Fenced')
    expect(result.text).toBe('Fenced body')
  })
})
