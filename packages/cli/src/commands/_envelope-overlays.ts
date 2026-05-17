import { coerceMeta } from '../core/envelope'

export function applyNoteEnvelopeMeta(
  payload: Record<string, unknown>,
  rawMeta: Record<string, unknown>,
): void {
  const meta = coerceMeta(rawMeta)
  if (meta.title !== undefined) payload.title = meta.title
  if (meta.slug !== undefined) payload.slug = meta.slug
  if (meta.topic !== undefined) payload.__topicName = meta.topic
  if (meta.state !== undefined) payload.isPublished = meta.state === 'publish'
  if (meta.mood !== undefined) payload.mood = meta.mood
  if (meta.weather !== undefined) payload.weather = meta.weather
  if (meta.publicAt !== undefined) payload.publicAt = meta.publicAt
  if (meta.password !== undefined) payload.password = meta.password
  if (meta.bookmark !== undefined) payload.bookmark = meta.bookmark
  if (meta.location !== undefined) payload.location = meta.location
}

export function applyPageEnvelopeMeta(
  payload: Record<string, unknown>,
  rawMeta: Record<string, unknown>,
): void {
  const meta = coerceMeta(rawMeta)
  if (meta.title !== undefined) payload.title = meta.title
  if (meta.slug !== undefined) payload.slug = meta.slug
  if (meta.subtitle !== undefined) payload.subtitle = meta.subtitle
  if (meta.order !== undefined) payload.order = meta.order
}
