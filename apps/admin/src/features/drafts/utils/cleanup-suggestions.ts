import type { CleanupCategory, CleanupPreview } from '~/models/draft'

export type CleanupSuggestion =
  | { bytes: number; count: number; kind: Extract<CleanupCategory, 'A' | 'B'> }
  | { bytes: number; count: number; kind: 'E'; samples: string[] }
  | { kind: 'auto' }

const SAMPLE_SIZE = 3

export function buildCleanupSuggestions(
  preview: CleanupPreview | undefined,
  autoCleanup: boolean | undefined,
): CleanupSuggestion[] {
  const cards: CleanupSuggestion[] = []
  if (preview) {
    for (const kind of ['B', 'A'] as const) {
      const { bytes, count } = preview.categories[kind]
      if (count > 0) cards.push({ bytes, count, kind })
    }
    const test = preview.categories.E
    if (test.count > 0)
      cards.push({
        ...test,
        kind: 'E',
        samples: preview.testDrafts
          .slice(0, SAMPLE_SIZE)
          .map((item) => item.title),
      })
  }
  if (!autoCleanup) cards.push({ kind: 'auto' })
  return cards
}
