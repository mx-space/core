import type { MetaFieldDescriptor } from '~/vendor/rich-editor/utils/meta-tools'

export interface AgentMetaFormState {
  bookmark: boolean
  categoryId: string
  contentFormat: 'lexical' | 'markdown'
  coordinatesLat: string
  coordinatesLng: string
  copyright: boolean
  freeUntil: string
  freeWindowHours: string
  isPremium: boolean
  location: string
  meta: Record<string, unknown>
  mood: string
  order: string
  password: string
  passwordProtected: boolean
  pin: boolean
  pinOrder: string
  previewBlocks: string
  publicAt: string
  purchaseEnabled: boolean
  relatedId: string
  slug: string
  subtitle: string
  summary: string
  tags: string
  title: string
  topicId: string
  weather: string
}

export interface AgentMetaEntity {
  id: string
  name?: string
  slug?: string
  title?: string
}

export interface AgentMetaContext {
  categories: readonly AgentMetaEntity[]
  relatedPosts: readonly AgentMetaEntity[]
  topics: readonly AgentMetaEntity[]
}

export const EMPTY_AGENT_META_CONTEXT: AgentMetaContext = {
  categories: [],
  relatedPosts: [],
  topics: [],
}

export interface AgentMetaField {
  descriptor: MetaFieldDescriptor
  read: (state: AgentMetaFormState, context: AgentMetaContext) => unknown
  write: (
    state: AgentMetaFormState,
    value: unknown,
    context: AgentMetaContext,
  ) => AgentMetaFormState
}

export type FieldRegistry = Record<string, AgentMetaField>

export const toText = (value: unknown) => String(value ?? '')
export const toCount = (value: unknown) => String(Number(value ?? 0) || 0)

export function requireBoolean(key: string, value: unknown) {
  if (typeof value !== 'boolean') {
    throw new TypeError(`${key} must be a boolean`)
  }
  return value
}

export function requireInteger(key: string, value: unknown, min: number) {
  const parsed = typeof value === 'string' ? Number(value) : value
  if (typeof parsed !== 'number' || !Number.isInteger(parsed) || parsed < min) {
    throw new TypeError(`${key} must be an integer >= ${min}`)
  }
  return parsed
}

export function splitCommaList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function textField(description: string, key: keyof AgentMetaFormState) {
  return {
    descriptor: { description, type: 'string' },
    read: (state) => state[key],
    write: (state, value) => ({ ...state, [key]: toText(value) }),
  } satisfies AgentMetaField
}

export function flagField(description: string, key: keyof AgentMetaFormState) {
  return {
    descriptor: { description, type: 'boolean' },
    read: (state) => state[key],
    write: (state, value) => ({ ...state, [key]: Boolean(value) }),
  } satisfies AgentMetaField
}

export const slugField = (example?: string): AgentMetaField => ({
  descriptor: {
    description: example
      ? 'URL path segment; prefer lowercase English words joined with hyphens.'
      : 'URL path segment; may be empty (then the nid path is used).',
    ...(example ? { example } : {}),
    type: 'string',
  },
  read: (state) => state.slug,
  write: (state, value) => ({ ...state, slug: toText(value) }),
})

function findEntity(value: unknown, entities: readonly AgentMetaEntity[]) {
  const needle = String(value ?? '').trim()
  if (!needle) return undefined
  return (
    entities.find((entity) => entity.id === needle) ??
    entities.find((entity) => entity.slug === needle) ??
    entities.find((entity) => (entity.name ?? entity.title) === needle)
  )
}

function describeEntity(id: string, entities: readonly AgentMetaEntity[]) {
  if (!id) return null
  const entity = entities.find((item) => item.id === id)
  const name = entity?.name ?? entity?.title
  return name ? { id, name } : { id }
}

const SNOWFLAKE_ID = /^\d+$/

export const relatedField: AgentMetaField = {
  descriptor: {
    description:
      'Related posts shown under the article. Read returns [{ id, title }]. Write replaces the whole list with an array of post ids, slugs or exact titles; [] clears it.',
    example: ['ai-efficiency-paradox'],
    type: 'string[]',
  },
  read: (state, { relatedPosts }) =>
    splitCommaList(state.relatedId).map((id) => {
      const title = relatedPosts.find((post) => post.id === id)?.title
      return title ? { id, title } : { id }
    }),
  write: (state, value, { relatedPosts }) => {
    if (!Array.isArray(value)) {
      throw new TypeError(
        'related must be an array of post ids, slugs or titles',
      )
    }
    const ids: string[] = []
    const unresolved: string[] = []
    for (const item of value) {
      const needle = String(item ?? '').trim()
      const id =
        findEntity(needle, relatedPosts)?.id ??
        (SNOWFLAKE_ID.test(needle) ? needle : undefined)
      if (!id) unresolved.push(String(item))
      else if (!ids.includes(id)) ids.push(id)
    }
    if (unresolved.length > 0) {
      throw new Error(`related: no post matches ${unresolved.join(', ')}`)
    }
    return { ...state, relatedId: ids.join(', ') }
  },
}

export const categoryField: AgentMetaField = {
  descriptor: {
    description:
      'Post category (required). Read returns { id, name }. Write accepts a category id, slug or exact name.',
    type: 'string',
  },
  read: (state, { categories }) => describeEntity(state.categoryId, categories),
  write: (state, value, { categories }) => {
    const category = findEntity(value, categories)
    if (!category) {
      const names = categories.map((item) => item.name ?? item.id).join(', ')
      throw new Error(
        `category: no category matches ${toText(value)}; available: ${names}`,
      )
    }
    return { ...state, categoryId: category.id }
  },
}

export const topicField: AgentMetaField = {
  descriptor: {
    description:
      'Note topic. Read returns { id, name } or null. Write accepts a topic id, slug or exact name; null or empty string clears it.',
    type: 'string',
  },
  read: (state, { topics }) => describeEntity(state.topicId, topics),
  write: (state, value, { topics }) => {
    if (value == null || value === '') return { ...state, topicId: '' }
    const topic = findEntity(value, topics)
    if (!topic) {
      const names = topics.map((item) => item.name ?? item.id).join(', ')
      throw new Error(
        `topic: no topic matches ${toText(value)}; available: ${names}`,
      )
    }
    return { ...state, topicId: topic.id }
  },
}

function toDatetimeLocalValue(date: Date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return offsetDate.toISOString().slice(0, 16)
}

export const publicAtField: AgentMetaField = {
  descriptor: {
    description:
      'Scheduled public time as an ISO datetime in the future; the note stays hidden until then. null or empty string clears it.',
    example: '2026-12-01T00:00:00.000Z',
    type: 'string',
  },
  read: (state) => {
    if (!state.publicAt) return null
    const date = new Date(state.publicAt)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  },
  write: (state, value) => {
    if (value == null || value === '') return { ...state, publicAt: '' }
    const date = typeof value === 'string' ? new Date(value) : null
    if (!date || Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
      throw new TypeError('publicAt must be a future ISO datetime string')
    }
    return { ...state, publicAt: toDatetimeLocalValue(date) }
  },
}

function isCoordinate(value: unknown, limit: number): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Math.abs(value) <= limit
  )
}

export const coordinatesField: AgentMetaField = {
  descriptor: {
    description:
      'Geographic coordinates of the note location; null clears them.',
    example: { latitude: 35.68, longitude: 139.76 },
    type: 'object',
  },
  read: (state) => {
    if (!state.coordinatesLat || !state.coordinatesLng) return null
    const latitude = Number(state.coordinatesLat)
    const longitude = Number(state.coordinatesLng)
    return Number.isNaN(latitude) || Number.isNaN(longitude)
      ? null
      : { latitude, longitude }
  },
  write: (state, value) => {
    if (value == null) {
      return { ...state, coordinatesLat: '', coordinatesLng: '' }
    }
    const { latitude, longitude } = value as Record<string, unknown>
    if (!isCoordinate(latitude, 90) || !isCoordinate(longitude, 180)) {
      throw new TypeError(
        'coordinates must be { latitude: -90..90, longitude: -180..180 } or null',
      )
    }
    return {
      ...state,
      coordinatesLat: String(latitude),
      coordinatesLng: String(longitude),
    }
  },
}

export const passwordProtectedField: AgentMetaField = {
  descriptor: {
    description:
      'Whether the note requires a password to read. Turning it off clears the password.',
    type: 'boolean',
  },
  read: (state) => state.passwordProtected,
  write: (state, value) => {
    const passwordProtected = requireBoolean('passwordProtected', value)
    return passwordProtected
      ? { ...state, passwordProtected }
      : { ...state, password: '', passwordProtected }
  },
}

export const passwordField: AgentMetaField = {
  descriptor: {
    description:
      'Write-only note password; setting a non-empty value also turns on passwordProtected. Read returns null and never reveals the value.',
    type: 'string',
  },
  // The password must never reach the model, so read stays opaque.
  read: () => null,
  write: (state, value) => {
    const password = toText(value)
    return password
      ? { ...state, password, passwordProtected: true }
      : { ...state, password: '' }
  },
}

export const coverField: AgentMetaField = {
  descriptor: {
    description:
      'Cover image URL stored in meta.cover; empty string or null removes it.',
    type: 'string',
  },
  read: (state) =>
    typeof state.meta.cover === 'string' ? state.meta.cover : null,
  write: (state, value) => {
    const meta = { ...state.meta }
    if (value == null || value === '') delete meta.cover
    else meta.cover = toText(value)
    return { ...state, meta }
  },
}

const RESERVED_META_KEYS = new Set(['paywall'])

export const metaField: AgentMetaField = {
  descriptor: {
    description:
      'Free-form meta JSON object (e.g. cover, skillIds). Write is a shallow merge: listed keys are replaced, keys set to null are removed, other keys stay. The paywall key is managed by the isPremium/paywall fields and cannot be written here.',
    example: { skillIds: ['skill-id'] },
    type: 'object',
  },
  read: (state) => state.meta,
  write: (state, value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new TypeError('meta must be an object')
    }
    const meta = { ...state.meta }
    for (const [key, item] of Object.entries(value)) {
      if (RESERVED_META_KEYS.has(key)) {
        throw new Error(`meta.${key} is managed by dedicated fields`)
      }
      if (item === null) delete meta[key]
      else meta[key] = item
    }
    return { ...state, meta }
  },
}
