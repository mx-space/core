import { describe, expect, it } from 'vitest'

import {
  DIRECT_TRANSLATION_MAX_SEGMENTS,
  DIRECT_TRANSLATION_MAX_SOURCE_CHARS,
  planTranslationChunks,
  shouldUseChunkedTranslation,
  TRANSLATION_CHUNK_MAX_SOURCE_CHARS,
} from '~/modules/ai/ai-translation/engine/translation-chunk-planner'
import type { TranslationUnit } from '~/modules/ai/ai-translation/translation-unit.types'
import { flatIdsOf } from '~/modules/ai/ai-translation/translation-unit.types'

describe('translation chunk planner', () => {
  it('keeps ordinary articles on the direct agent path', () => {
    const units: TranslationUnit[] = [
      { id: 'p1', payload: 'a'.repeat(4_000), meta: 'text' },
      { id: 'p2', payload: 'b'.repeat(4_000), meta: 'text' },
    ]
    expect(shouldUseChunkedTranslation(units)).toBe(false)
  })

  it('routes source payloads above the direct budget to chunked translation', () => {
    const units: TranslationUnit[] = [
      {
        id: 'p1',
        payload: 'a'.repeat(DIRECT_TRANSLATION_MAX_SOURCE_CHARS + 1),
        meta: 'text',
      },
    ]
    expect(shouldUseChunkedTranslation(units)).toBe(true)
  })

  it('uses segment pressure without routing ordinary structured articles', () => {
    const ordinary = Array.from({ length: 100 }, (_, index) => ({
      id: `p${index}`,
      payload: 'short',
      meta: 'text',
    }))
    const pathological = Array.from(
      { length: DIRECT_TRANSLATION_MAX_SEGMENTS + 1 },
      (_, index) => ({
        id: `p${index}`,
        payload: 'short',
        meta: 'text',
      }),
    )

    expect(shouldUseChunkedTranslation(ordinary)).toBe(false)
    expect(shouldUseChunkedTranslation(pathological)).toBe(true)
  })

  it('preserves order and never splits an inline group', () => {
    const group: TranslationUnit = {
      id: 'group',
      payload: {
        type: 'text.group',
        segments: [
          { id: 'g1', text: 'b'.repeat(2_000) },
          { id: 'g2', text: 'c'.repeat(2_000) },
        ],
      },
      meta: 'text.group',
      memberIds: ['g1', 'g2'],
    }
    const units: TranslationUnit[] = [
      {
        id: 'p1',
        payload: 'a'.repeat(TRANSLATION_CHUNK_MAX_SOURCE_CHARS - 1_000),
        meta: 'text',
      },
      group,
      { id: 'p2', payload: 'd'.repeat(1_000), meta: 'text' },
    ]
    const chunks = planTranslationChunks(units)

    expect(chunks).toHaveLength(2)
    expect(chunks[1].units[0]).toBe(group)
    expect(chunks.flatMap((chunk) => flatIdsOf(chunk.units))).toEqual([
      'p1',
      'g1',
      'g2',
      'p2',
    ])
  })
})
