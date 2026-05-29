import type { DraftRefType } from '~/models/draft'

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
