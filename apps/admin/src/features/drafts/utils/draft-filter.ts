import type { DraftRefType, DraftRelation } from '~/models/draft'
import { DraftRefType as DraftRefTypeValue } from '~/models/draft'

export function parseDraftFilterType(
  value: string | null,
): DraftRefType | 'all' {
  if (
    value === DraftRefTypeValue.Post ||
    value === DraftRefTypeValue.Note ||
    value === DraftRefTypeValue.Page
  ) {
    return value
  }

  return 'all'
}

export type DraftRelationFilter = DraftRelation | 'all'
export type DraftSort = 'size' | 'updated'

export function parseDraftRelation(value: string | null): DraftRelationFilter {
  return value === 'in_sync' || value === 'ahead' || value === 'fresh'
    ? value
    : 'all'
}

export function parseDraftSort(value: string | null): DraftSort {
  return value === 'size' ? 'size' : 'updated'
}
