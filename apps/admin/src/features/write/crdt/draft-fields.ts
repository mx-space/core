import type { DraftFields } from '~/models/draft'

export type DraftFieldsPatch = Partial<
  Record<keyof DraftFields, Record<string, unknown>>
>

const changedKeys = (
  acked: Record<string, unknown> | null,
  next: Record<string, unknown> | null,
) => {
  const patch: Record<string, unknown> = {}
  for (const key of new Set([
    ...Object.keys(acked ?? {}),
    ...Object.keys(next ?? {}),
  ])) {
    const value = next?.[key] ?? null
    if (JSON.stringify(acked?.[key] ?? null) !== JSON.stringify(value)) {
      patch[key] = value
    }
  }
  return Object.keys(patch).length ? patch : undefined
}

export function diffDraftFields(
  acked: DraftFields,
  next: DraftFields,
): DraftFieldsPatch | null {
  const meta = changedKeys(acked.meta, next.meta)
  const typeSpecificData = changedKeys(
    acked.typeSpecificData,
    next.typeSpecificData,
  )
  if (!meta && !typeSpecificData) return null
  return {
    ...(meta ? { meta } : {}),
    ...(typeSpecificData ? { typeSpecificData } : {}),
  }
}
