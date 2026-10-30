import { type DocFields, SECRET_FIELD_KEYS } from '@mx-space/editor/loro'

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

const SECTIONS = ['meta', 'typeSpecificData'] as const

export function splitSecretFields(patch: DraftFieldsPatch): {
  document: DraftFieldsPatch | null
  secret: DraftFieldsPatch | null
} {
  const document: DraftFieldsPatch = {}
  const secret: DraftFieldsPatch = {}
  for (const section of SECTIONS) {
    for (const [key, value] of Object.entries(patch[section] ?? {})) {
      const side = SECRET_FIELD_KEYS.has(key) ? secret : document
      side[section] = { ...side[section], [key]: value }
    }
  }
  const orNull = (side: DraftFieldsPatch) =>
    Object.keys(side).length ? side : null
  return { document: orNull(document), secret: orNull(secret) }
}

export function applyFieldsPatch(
  fields: DraftFields,
  patch: DraftFieldsPatch,
): DraftFields {
  const next: DraftFields = { ...fields }
  for (const section of SECTIONS) {
    const changes = patch[section]
    if (!changes) continue
    const values = { ...next[section] }
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) delete values[key]
      else values[key] = value
    }
    next[section] = values
  }
  return next
}

export function withLocalSecrets(
  fields: DocFields,
  local: DraftFields,
): DraftFields {
  const merged: DraftFields = { ...fields }
  for (const section of SECTIONS) {
    const own = Object.entries(merged[section] ?? {}).filter(
      ([key]) => !SECRET_FIELD_KEYS.has(key),
    )
    const secrets = Object.entries(local[section] ?? {}).filter(([key]) =>
      SECRET_FIELD_KEYS.has(key),
    )
    if (merged[section] || secrets.length) {
      merged[section] = Object.fromEntries([...own, ...secrets])
    }
  }
  return merged
}
