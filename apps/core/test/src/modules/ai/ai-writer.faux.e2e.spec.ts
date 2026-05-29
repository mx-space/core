import { fauxAssistantMessage, fauxToolCall } from '@earendil-works/pi-ai'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { withFauxAi } from '@/helper/faux-ai.helper'
import { AIProviderType } from '~/modules/ai/ai.types'
import { AiWriterService } from '~/modules/ai/ai-writer/ai-writer.service'
import { PiRuntimeAdapter } from '~/modules/ai/runtime/pi-runtime.adapter'

const PROVIDER = 'faux-writer'
const MODEL_ID = 'faux-writer-model'

function makeRuntime(responses: ReturnType<typeof fauxAssistantMessage>[]) {
  const handle = withFauxAi({
    api: 'openai-completions',
    provider: PROVIDER,
    models: [{ id: MODEL_ID, name: MODEL_ID }],
    responses,
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

const torn: Array<() => void> = []
afterEach(() => {
  while (torn.length) torn.pop()!()
})

describe('ai-writer faux e2e', () => {
  it('generates title + slug via structured output (happy path)', async () => {
    const r = makeRuntime([
      fauxAssistantMessage([
        fauxToolCall('structured_output', {
          title: 'A Generated Title',
          slug: 'a-generated-title',
          lang: 'en',
          keywords: ['ai'],
        }),
      ]),
    ])
    torn.push(r.teardown)
    const aiService = { getWriterModel: vi.fn(async () => r.adapter) }
    const service = new AiWriterService(aiService as any)
    const out = await service.generateTitleAndSlugByOpenAI(
      'The quick brown fox jumps over the lazy dog.',
    )
    expect(out.title).toBe('A Generated Title')
    expect(out.slug).toBe('a-generated-title')
  })

  it('falls back when AI throws (structured validation maxIterations)', async () => {
    // 5 text-only responses -> maxIterations -> service catches + falls back
    const r = makeRuntime(
      Array.from({ length: 5 }, () => fauxAssistantMessage('not a tool call')),
    )
    torn.push(r.teardown)
    const aiService = { getWriterModel: vi.fn(async () => r.adapter) }
    const service = new AiWriterService(aiService as any)
    const out = await service.generateTitleAndSlugByOpenAI(
      'Some text that will be sliced for fallback.',
    )
    // Fallback path returns string title and lang=en
    expect(out.lang).toBe('en')
    expect(typeof out.title).toBe('string')
    expect(typeof out.slug).toBe('string')
  })

  it('generateSlugByTitleViaOpenAI happy path', async () => {
    const r = makeRuntime([
      fauxAssistantMessage([
        fauxToolCall('structured_output', { slug: 'hello-world' }),
      ]),
    ])
    torn.push(r.teardown)
    const aiService = { getWriterModel: vi.fn(async () => r.adapter) }
    const service = new AiWriterService(aiService as any)
    const out = await service.generateSlugByTitleViaOpenAI('Hello World')
    expect(out.slug).toBe('hello-world')
  })
})
