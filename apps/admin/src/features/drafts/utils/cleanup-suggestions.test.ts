import { describe, expect, it } from 'vitest'

import type { CleanupPreview } from '~/models/draft'

import { buildCleanupSuggestions } from './cleanup-suggestions'

function preview(
  counts: Partial<Record<'A' | 'B' | 'C' | 'D' | 'E', number>>,
): CleanupPreview {
  const category = (count = 0) => ({ bytes: count * 100, count })
  return {
    archived: [],
    categories: {
      A: category(counts.A),
      B: category(counts.B),
      C: category(counts.C),
      D: category(counts.D),
      E: category(counts.E),
    },
    inSync: [],
    olderThanDays: 30,
    testDrafts: [
      { bytes: 1, documentId: '1', draftId: '1', title: 'agent-new-e2e' },
      { bytes: 1, documentId: '2', draftId: '2', title: 'md-e2e-1' },
      { bytes: 1, documentId: '3', draftId: '3', title: '' },
      { bytes: 1, documentId: '4', draftId: '4', title: 'tmp-x' },
    ],
  }
}

describe('buildCleanupSuggestions', () => {
  it('orders cards B, A, E, auto', () => {
    const cards = buildCleanupSuggestions(preview({ A: 2, B: 5, E: 4 }), false)
    expect(cards.map((card) => card.kind)).toEqual(['B', 'A', 'E', 'auto'])
    expect(cards[0]).toMatchObject({ bytes: 500, count: 5 })
    expect(cards[2]).toMatchObject({
      samples: ['agent-new-e2e', 'md-e2e-1', ''],
    })
  })

  it('skips categories with nothing to clean', () => {
    const cards = buildCleanupSuggestions(preview({ A: 0, B: 3, E: 0 }), false)
    expect(cards.map((card) => card.kind)).toEqual(['B', 'auto'])
  })

  it('adds the auto cleanup card only when auto cleanup is off', () => {
    const cards = buildCleanupSuggestions(preview({ B: 1 }), true)
    expect(cards.map((card) => card.kind)).toEqual(['B'])
  })

  it('returns no category cards without a preview', () => {
    expect(
      buildCleanupSuggestions(undefined, false).map((card) => card.kind),
    ).toEqual(['auto'])
  })
})
