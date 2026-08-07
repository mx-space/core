export interface TranslationUnit {
  id: string
  payload:
    | string
    | {
        type: 'text.group'
        segments: Array<{ id: string; text: string }>
      }
  meta: string
  memberIds?: string[]
}

export function unitsToEntries(
  units: TranslationUnit[],
): Record<string, unknown> {
  return Object.fromEntries(units.map((unit) => [unit.id, unit.payload]))
}

export function unitsToMeta(units: TranslationUnit[]): Record<string, string> {
  return Object.fromEntries(units.map((unit) => [unit.id, unit.meta]))
}

export function unitsToSourceMap(
  units: TranslationUnit[],
): Record<string, string> {
  const map: Record<string, string> = {}
  for (const unit of units) {
    if (typeof unit.payload === 'string') {
      map[unit.id] = unit.payload
      continue
    }
    for (const segment of unit.payload.segments) {
      map[segment.id] = segment.text
    }
  }
  return map
}

export function flatIdsOf(units: TranslationUnit[]): string[] {
  return units.flatMap((unit) => unit.memberIds ?? [unit.id])
}
