import { describe, expect, it, vi } from 'vitest'

import { planTranslationChunks } from '~/modules/ai/ai-translation/engine/translation-chunk-planner'
import {
  createTranslationCoordinatorTools,
  TRANSLATION_SUB_AGENT_CONCURRENCY,
} from '~/modules/ai/ai-translation/engine/translation-coordinator'
import { TRANSLATION_FILE } from '~/modules/ai/ai-translation/engine/translation-tools'
import type { TranslationUnit } from '~/modules/ai/ai-translation/translation-unit.types'

const runtimeFor = (
  handler: (prompt: string) => Promise<{
    output: unknown
    usage?: {
      completionTokens?: number
      costBreakdown?: { total?: number }
    }
  }>,
) =>
  ({
    providerInfo: { id: 'stub', type: 'openai-compatible', model: 'stub' },
    generateText: vi.fn(),
    generateStructured: vi.fn(({ prompt }: { prompt: string }) =>
      handler(prompt),
    ),
  }) as any

describe('translation coordinator tools', () => {
  it('delegates isolated chunks with bounded concurrency and merges by segment id', async () => {
    const markers = ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA']
    const units: TranslationUnit[] = markers.map((marker, index) => ({
      id: `p${index + 1}`,
      payload: marker.repeat(1_200),
      meta: 'text',
    }))
    const chunks = planTranslationChunks(units)
    let active = 0
    let maxActive = 0
    const prompts: string[] = []
    const runtime = runtimeFor(async (prompt) => {
      prompts.push(prompt)
      active++
      maxActive = Math.max(maxActive, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active--
      const segments = prompt.split('## Segments to translate\n').at(-1)!
      const id = segments.match(/"(p\d+)":/)?.[1]
      const index = Number(id?.slice(1)) - 1
      return {
        output: {
          sourceLang: 'en',
          translations: { [`p${index + 1}`]: `translated-${index + 1}` },
        },
        usage: { completionTokens: 5, costBreakdown: { total: 0.01 } },
      }
    })
    const onToken = vi.fn(async () => {})
    const onCost = vi.fn(async () => {})
    const created = createTranslationCoordinatorTools({
      chunks,
      allUnits: units,
      targetLang: 'ja',
      documentContext: `document${'x'.repeat(4_000)}CONTEXT_LEAK_SENTINEL`,
      runtime,
      onToken,
      onCost,
    })
    const translate = created.tools.find(
      (tool) => tool.name === 'translate_chunks',
    )!

    const result = await translate.execute({
      chunkIds: chunks.map((chunk) => chunk.id),
    })

    expect(JSON.parse(result.content)).toMatchObject({
      completed: chunks.map((chunk) => chunk.id),
      failed: [],
      missingSegments: 0,
    })
    expect(maxActive).toBe(TRANSLATION_SUB_AGENT_CONCURRENCY)
    expect(created.vfs.read(TRANSLATION_FILE)).toEqual({
      p1: 'translated-1',
      p2: 'translated-2',
      p3: 'translated-3',
      p4: 'translated-4',
    })
    for (const prompt of prompts) {
      const segments = prompt.split('## Segments to translate\n').at(-1)!
      expect(
        markers.filter((marker) => segments.includes(marker)),
      ).toHaveLength(1)
      expect(prompt).not.toContain('CONTEXT_LEAK_SENTINEL')
    }
    expect(onToken).toHaveBeenCalledTimes(4)
    expect(onCost).toHaveBeenCalledTimes(4)
  })

  it('retries only the failed chunk within the tool call', async () => {
    const units: TranslationUnit[] = [
      { id: 'p1', payload: 'source', meta: 'text' },
    ]
    const chunks = planTranslationChunks(units)
    let calls = 0
    const runtime = runtimeFor(async () => {
      if (++calls === 1) throw new Error('temporary provider failure')
      return {
        output: {
          sourceLang: 'en',
          translations: { p1: 'translated' },
        },
      }
    })
    const created = createTranslationCoordinatorTools({
      chunks,
      allUnits: units,
      targetLang: 'ja',
      documentContext: 'document',
      runtime,
    })
    const translate = created.tools.find(
      (tool) => tool.name === 'translate_chunks',
    )!

    await translate.execute({ chunkIds: ['chunk-1'] })

    expect(calls).toBe(2)
    expect(created.state.chunks['chunk-1']).toMatchObject({
      status: 'completed',
      attempts: 2,
    })
    expect(created.vfs.read(TRANSLATION_FILE)).toEqual({ p1: 'translated' })
  })

  it('propagates cancellation without converting it into a chunk retry', async () => {
    const units: TranslationUnit[] = [
      { id: 'p1', payload: 'source', meta: 'text' },
    ]
    const chunks = planTranslationChunks(units)
    const runtime = {
      providerInfo: { id: 'stub', type: 'openai-compatible', model: 'stub' },
      generateText: vi.fn(),
      generateStructured: vi.fn(async ({ signal }: { signal: AbortSignal }) => {
        if (signal.aborted) throw new DOMException('aborted', 'AbortError')
        return {
          output: {
            sourceLang: 'en',
            translations: { p1: 'translated' },
          },
        }
      }),
    } as any
    const created = createTranslationCoordinatorTools({
      chunks,
      allUnits: units,
      targetLang: 'ja',
      documentContext: 'document',
      runtime,
    })
    const translate = created.tools.find(
      (tool) => tool.name === 'translate_chunks',
    )!
    const controller = new AbortController()
    controller.abort()

    await expect(
      translate.execute({ chunkIds: ['chunk-1'] }, controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(runtime.generateStructured).toHaveBeenCalledTimes(1)
    expect(created.state.chunks['chunk-1'].attempts).toBe(1)
  })
})
