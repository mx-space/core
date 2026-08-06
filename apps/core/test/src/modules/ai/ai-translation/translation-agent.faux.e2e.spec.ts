import { fauxAssistantMessage, fauxToolCall } from '@earendil-works/pi-ai'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { withFauxAi } from '@/helper/faux-ai.helper'
import { AIProviderType } from '~/modules/ai/ai.types'
import { runTranslationAgent } from '~/modules/ai/ai-translation/engine/translation-agent'
import type { PipelineMetrics } from '~/modules/ai/ai-translation/translation-strategy.interface'
import type { TranslationUnit } from '~/modules/ai/ai-translation/translation-unit.types'
import { PiRuntimeAdapter } from '~/modules/ai/runtime/pi-runtime.adapter'

const PROVIDER = 'faux-translation-agent'
const MODEL_ID = 'faux-agent-model'

const units: TranslationUnit[] = [
  { id: 'text:p1', payload: '你好', meta: 'text' },
  { id: '__title__', payload: '标题', meta: 'meta.title' },
]

const torn: Array<() => void> = []
afterEach(() => {
  while (torn.length) torn.pop()!()
})

function makeRuntime(responses: ReturnType<typeof fauxAssistantMessage>[]) {
  const handle = withFauxAi({
    api: 'openai-completions',
    provider: PROVIDER,
    models: [{ id: MODEL_ID, name: MODEL_ID }],
    responses,
  })
  torn.push(() => handle.teardown())
  return new PiRuntimeAdapter({
    apiKey: 'k',
    endpoint: `https://${PROVIDER}.example.com`,
    model: MODEL_ID,
    providerType: AIProviderType.OpenAICompatible,
    providerId: PROVIDER,
  })
}

const reviewerStub = (outputs: Array<{ issues: unknown[] }>) => {
  let call = 0
  return {
    providerInfo: { id: 'stub', type: 'openai-compatible', model: 'stub' },
    generateText: vi.fn(),
    generateStructured: vi.fn(async () => ({
      output: outputs[Math.min(call++, outputs.length - 1)],
    })),
  } as any
}

describe('runTranslationAgent (faux e2e)', () => {
  it('write → review → patch → re-review → finish', async () => {
    const runtime = makeRuntime([
      fauxAssistantMessage([
        fauxToolCall('write_translation', {
          sourceLang: 'zh',
          translations: { 'text:p1': '訳文A', __title__: '題' },
        }),
      ]),
      fauxAssistantMessage([fauxToolCall('request_review', {})]),
      fauxAssistantMessage([
        fauxToolCall('patch_translation', {
          edits: [{ id: 'text:p1', find: '訳文A', replace: '訳文A改' }],
        }),
      ]),
      fauxAssistantMessage([fauxToolCall('request_review', {})]),
      fauxAssistantMessage('done'),
    ])
    const reviewerRuntime = reviewerStub([
      {
        issues: [{ id: 'text:p1', severity: 'minor', problem: 'p', hint: 'h' }],
      },
      { issues: [] },
    ])
    const segmentEvents: Record<string, string>[] = []
    const metrics: PipelineMetrics = {}

    const result = await runTranslationAgent({
      targetLang: 'ja',
      units,
      documentContext: 'DOC',
      styleHints: 'ARTICLE_TYPE: note',
      runtime,
      reviewerRuntime,
      metrics,
      onSegments: async (segments) => {
        segmentEvents.push(segments)
      },
    })

    expect(result.sourceLang).toBe('zh')
    expect(result.translations.get('text:p1')).toBe('訳文A改')
    expect(result.translations.get('__title__')).toBe('題')

    expect(metrics.reviewer?.rounds).toBe(2)
    expect(metrics.reviewer?.issuesCount).toBe(0)
    expect(metrics.editor?.patches).toEqual([
      { id: 'text:p1', before: '訳文A', after: '訳文A改' },
    ])

    const firstPrompt =
      reviewerRuntime.generateStructured.mock.calls[0][0].prompt
    const secondPrompt =
      reviewerRuntime.generateStructured.mock.calls[1][0].prompt
    expect(firstPrompt).not.toContain('"source"')
    expect(secondPrompt).toContain('"source"')

    expect(segmentEvents[0]).toEqual({ 'text:p1': '訳文A', __title__: '題' })
    expect(segmentEvents[1]).toEqual({ 'text:p1': '訳文A改' })
  })

  it('no reviewerRuntime → review tool absent, metrics review-disabled', async () => {
    const runtime = makeRuntime([
      fauxAssistantMessage([
        fauxToolCall('write_translation', {
          sourceLang: 'zh',
          translations: { 'text:p1': '訳', __title__: '題' },
        }),
      ]),
      fauxAssistantMessage('done'),
    ])
    const metrics: PipelineMetrics = {}
    const result = await runTranslationAgent({
      targetLang: 'ja',
      units,
      documentContext: 'DOC',
      runtime,
      metrics,
    })
    expect(result.translations.get('text:p1')).toBe('訳')
    expect(metrics.reviewer?.skippedReason).toBe('review-disabled')
    expect(metrics.editor?.skippedReason).toBe('review-disabled')
  })
})
