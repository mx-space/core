import type {
  EntryTranslation,
  InteractionMeta,
  ResponseMeta,
} from '~/models/base'

const TRANSLATION_KEYS = new Set<keyof EntryTranslation>(['article', 'fields'])
const INTERACTION_KEYS = new Set<keyof InteractionMeta>([
  'isLiked',
  'likeCount',
  'readCount',
])

// The key-subset test is the distinguisher: single-shape objects only have
// domain-specific keys (e.g. 'article', 'isLiked'), while record shapes have
// snowflake id strings as keys. Snowflake ids are long numeric strings that
// never collide with the known domain key names.
function resolveMetaField<T>(
  value: T | Record<string, T> | undefined,
  id: string,
  allowedKeys: Set<keyof T>,
): T | undefined {
  if (value === undefined || value === null) return undefined
  const keys = Object.keys(value as object)
  if (keys.length === 0) return undefined
  if (keys.every((k) => allowedKeys.has(k as keyof T))) {
    return value as T
  }
  return (value as Record<string, T>)[id]
}

export function metaFor(
  item: { id: string },
  meta: ResponseMeta | undefined,
): { interaction?: InteractionMeta; translation?: EntryTranslation } {
  if (!meta) return {}

  const translation = resolveMetaField<EntryTranslation>(
    meta.translation,
    item.id,
    TRANSLATION_KEYS,
  )
  const interaction = resolveMetaField<InteractionMeta>(
    meta.interaction,
    item.id,
    INTERACTION_KEYS,
  )

  return { translation, interaction }
}
