import { z } from 'zod'

declare const ENTITY_ID_BRAND: unique symbol

export type EntityId = string & { readonly [ENTITY_ID_BRAND]: 'EntityId' }

const ENTITY_ID_REGEX = /^[1-9]\d{0,18}$/

export const ENTITY_ID_MAX_BIGINT = 9_223_372_036_854_775_807n

export function isEntityIdString(value: unknown): value is EntityId {
  if (typeof value !== 'string') return false
  if (!ENTITY_ID_REGEX.test(value)) return false
  let big: bigint
  try {
    big = BigInt(value)
  } catch {
    return false
  }
  return big > 0n && big <= ENTITY_ID_MAX_BIGINT
}

export function parseEntityId(input: EntityId | string): bigint {
  if (typeof input !== 'string') {
    throw new TypeError(`EntityId must be a string, received ${typeof input}`)
  }
  if (!ENTITY_ID_REGEX.test(input)) {
    throw new Error(`Invalid EntityId format: ${input}`)
  }
  const value = BigInt(input)
  if (value <= 0n || value > ENTITY_ID_MAX_BIGINT) {
    throw new Error(`EntityId out of bigint range: ${input}`)
  }
  return value
}

export function serializeEntityId(value: bigint): EntityId {
  if (typeof value !== 'bigint') {
    throw new TypeError(
      `serializeEntityId expects bigint, received ${typeof value}`,
    )
  }
  if (value <= 0n || value > ENTITY_ID_MAX_BIGINT) {
    throw new Error(`bigint out of EntityId range: ${value}`)
  }
  return value.toString() as EntityId
}

export function tryParseEntityId(
  input: unknown,
): { ok: true; value: bigint } | { ok: false } {
  if (typeof input !== 'string') return { ok: false }
  if (!ENTITY_ID_REGEX.test(input)) return { ok: false }
  try {
    const value = BigInt(input)
    if (value <= 0n || value > ENTITY_ID_MAX_BIGINT) return { ok: false }
    return { ok: true, value }
  } catch {
    return { ok: false }
  }
}

export const zEntityId = z
  .string()
  .refine(isEntityIdString, { message: 'Invalid entity id' })
  .transform((val) => val as EntityId)

export const zEntityIdOrInt = z.union([
  zEntityId,
  z.coerce.number().int().positive(),
])
