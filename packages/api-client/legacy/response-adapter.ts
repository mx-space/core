import type {
  ResponseAdapter,
  ResponseAdapterContext,
} from '~/interfaces/client'
import {
  attachRawFromOneToAnthor,
  destructureData,
  isPlainObject,
  isResponseEnvelope,
} from '~/utils'

export type LegacyResponseAdapterMatcher =
  | string
  | RegExp
  | ((context: ResponseAdapterContext) => boolean)

export interface LegacyResponseAdapterOptions {
  /**
   * Apply legacy conversion only to matched request paths.
   * String matchers compare against both `/path` and `METHOD /path`.
   */
  only?: LegacyResponseAdapterMatcher[]
  /**
   * Skip legacy conversion for matched request paths.
   * Useful when a downstream app migrates one endpoint at a time.
   */
  except?: LegacyResponseAdapterMatcher[]
}

const toMatcherList = (value: LegacyResponseAdapterMatcher[] | undefined) =>
  value?.length ? value : undefined

function normalizePath(path: string) {
  return path.startsWith('/') ? path : `/${path}`
}

function matches(
  context: ResponseAdapterContext,
  matcher: LegacyResponseAdapterMatcher,
) {
  if (typeof matcher === 'function') return matcher(context)

  const path = normalizePath(context.path)
  const methodPath = `${context.method.toUpperCase()} ${path}`
  if (typeof matcher === 'string') {
    return matcher === path || matcher === methodPath
  }

  return matcher.test(path) || matcher.test(methodPath)
}

function shouldTransform(
  context: ResponseAdapterContext,
  options: LegacyResponseAdapterOptions,
) {
  const only = toMatcherList(options.only)
  if (only && !only.some((matcher) => matches(context, matcher))) return false

  const except = toMatcherList(options.except)
  if (except?.some((matcher) => matches(context, matcher))) return false

  return true
}

// --- helpers ---------------------------------------------------------------
// All field names here are camelCase — the client's default transformResponse
// runs camelcaseKeys on the raw snake_case wire payload before it reaches this
// adapter. So `is_liked` arrives as `isLiked`, `source_lang` as `sourceLang`, etc.

const stripPath = (p: string) => p.split('?')[0].replace(/\/+$/, '') || '/'

function pickRecordEntry<T>(
  value: T | Record<string, T> | undefined,
  id: string | undefined,
  knownKeys: string[],
): T | undefined {
  if (!value || typeof value !== 'object') return undefined
  const keys = Object.keys(value as object)
  if (keys.length === 0) return undefined
  // Heuristic: a record keyed by snowflake id (long numeric strings) vs a
  // flat shape whose keys are known field names.
  const looksKeyed = keys.every((k) => /^\d{8,}$/.test(k))
  if (looksKeyed) {
    return id ? (value as Record<string, T>)[id] : undefined
  }
  if (knownKeys.some((k) => keys.includes(k))) return value as T
  return id ? (value as Record<string, T>)[id] : undefined
}

function buildTranslationFlat(translation: any): Record<string, unknown> {
  if (!translation?.article) return {}
  const a = translation.article
  const out: Record<string, unknown> = {}
  if ('isTranslated' in a) out.isTranslated = a.isTranslated ?? false
  if (a.sourceLang != null) out.sourceLang = a.sourceLang
  if ('availableTranslations' in a)
    out.availableTranslations = a.availableTranslations ?? []
  if (a.isTranslated) {
    out.translationMeta = {
      sourceLang: a.sourceLang,
      targetLang: a.targetLang,
      translatedAt: a.translatedAt,
      model: a.model,
    }
  }
  return out
}

function buildInteractionFlat(interaction: any): Record<string, unknown> {
  if (!interaction || typeof interaction !== 'object') return {}
  const out: Record<string, unknown> = {}
  if ('isLiked' in interaction) out.isLiked = !!interaction.isLiked
  if ('likeCount' in interaction) out.likeCount = interaction.likeCount
  if ('readCount' in interaction) out.readCount = interaction.readCount
  return out
}

function buildInsightsFlat(insights: any): Record<string, unknown> {
  if (!insights || typeof insights !== 'object') return {}
  const out: Record<string, unknown> = {}
  if ('hasInLocale' in insights)
    out.hasInsightsInLocale = !!insights.hasInLocale
  return out
}

function flattenMetaIntoItem(item: any, meta: any): any {
  if (!isPlainObject(item) || typeof (item as any).id !== 'string') return item
  if (!meta || typeof meta !== 'object') return item

  const id = (item as any).id
  const translation = pickRecordEntry(meta.translation, id, ['article'])
  const interaction = pickRecordEntry(meta.interaction, id, [
    'isLiked',
    'likeCount',
    'readCount',
  ])

  const tFlat = buildTranslationFlat(translation)
  const iFlat = buildInteractionFlat(interaction)
  const insightsFlat = buildInsightsFlat(meta.insights)

  const extras: Record<string, unknown> = {}
  if (meta.enrichments !== undefined) extras.enrichments = meta.enrichments
  if (meta.related !== undefined) extras.related = meta.related

  if (
    Object.keys(tFlat).length === 0 &&
    Object.keys(iFlat).length === 0 &&
    Object.keys(insightsFlat).length === 0 &&
    Object.keys(extras).length === 0
  ) {
    return item
  }

  const next: Record<string, unknown> = {
    ...(item as Record<string, unknown>),
    ...tFlat,
    ...iFlat,
    ...insightsFlat,
    ...extras,
  }
  attachRawFromOneToAnthor(item, next)
  return next
}

function flattenNestedArrays(raw: any, meta: any, keys: string[]) {
  if (!isPlainObject(raw)) return raw
  const out = { ...raw }
  for (const key of keys) {
    if (Array.isArray(out[key])) {
      out[key] = out[key].map((it: any) => flattenMetaIntoItem(it, meta))
    }
  }
  return out
}

// Pagination shape normalization (camelCase after default camelcaseKeys):
//   V2:  { page, size, total, totalPages }
//   Legacy adapters also expose hasNextPage/hasPrevPage as convenience flags.
function remapPagination(pg: any): any {
  if (!pg || typeof pg !== 'object') return pg
  const page = pg.page ?? pg.currentPage
  const size = pg.size
  const total = pg.total
  const totalPages = pg.totalPages ?? pg.totalPage
  const hasNextPage =
    pg.hasNextPage ??
    (typeof page === 'number' && typeof totalPages === 'number'
      ? page < totalPages
      : undefined)
  const hasPrevPage =
    pg.hasPrevPage ?? (typeof page === 'number' ? page > 1 : undefined)

  // V2 wire used `currentPage` / `totalPage`; V3 wire uses `page` / `totalPages`.
  // Emit both so consumers migrating field-by-field don't break — the typed
  // `Pager` interface exposes the V3 names plus the V2 aliases as optional.
  const out: Record<string, unknown> = {
    page,
    currentPage: page,
    total,
    size,
    totalPages,
    totalPage: totalPages,
    hasNextPage,
    hasPrevPage,
  }
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k]
  return out
}

// --- per-endpoint rules ----------------------------------------------------

interface RuleContext {
  path: string
  method: string
  meta: any
}

interface Rule {
  match: RegExp | ((path: string, method: string) => boolean)
  fn: (data: any, ctx: RuleContext) => any
}

const COMMENT_LIST_REGEX = /^\/comments\/ref\/[^/]+$/
const COMMENT_THREAD_REGEX = /^\/comments\/thread\/[^/]+$/
const NOTE_DETAIL_REGEX =
  /^\/notes\/(?:nid\/\d+|latest|\d{4}(?:\/\d{1,2}){2}\/[^/]+)$/
const COMMENT_UPLOAD_CONFIG_REGEX = /^\/comments\/uploads\/config$/
const ACTIVITY_PRESENCE_REGEX = /^\/activity\/presence$/
const NOTE_MIDDLE_LIST_REGEX = /^\/notes\/list\/[^/]+$/
const NOTE_TOPIC_LIST_REGEX = /^\/notes\/topics\/[^/]+$/

function unwrapInnerEnvelope(data: any) {
  if (
    isPlainObject(data) &&
    'data' in data &&
    Array.isArray((data as any).data) &&
    isPlainObject((data as any).meta)
  ) {
    return data
  }
  return undefined
}

const commentListRule: Rule = {
  match: COMMENT_LIST_REGEX,
  fn: (raw, ctx) => {
    const inner = unwrapInnerEnvelope(raw) ?? raw
    const items: any[] = Array.isArray(inner.data)
      ? inner.data
      : Array.isArray(raw?.data)
        ? raw.data
        : []
    const pagination = remapPagination(
      inner.meta?.pagination ?? ctx.meta?.pagination ?? raw?.pagination,
    )

    const readers: Record<string, any> = isPlainObject(raw?.readers)
      ? { ...(raw.readers as Record<string, any>) }
      : {}
    const cleanedItems = items.map((it) => {
      const readerId =
        (it && (it.readerId ?? it.reader_id)) ?? it?.reader?.id ?? null
      if (it?.reader && readerId) readers[readerId] = it.reader
      if (it && 'reader' in it) {
        const { reader: _drop, ...rest } = it
        return rest
      }
      return it
    })

    const out: Record<string, unknown> = { data: cleanedItems }
    if (pagination !== undefined) out.pagination = pagination
    out.readers = readers
    return out
  },
}

const commentThreadRule: Rule = {
  match: COMMENT_THREAD_REGEX,
  fn: (raw) => {
    if (!isPlainObject(raw)) return raw
    // V1 returned { replies, remaining, done }; V2 adds nextCursor.
    const { nextCursor: _drop, ...rest } = raw as any
    return rest
  },
}

const noteDetailRule: Rule = {
  match: NOTE_DETAIL_REGEX,
  fn: (raw, ctx) => {
    if (!isPlainObject(raw)) return raw
    // V1 already wraps the model under `data`; pass through (with meta flatten).
    if (
      isPlainObject((raw as any).data) &&
      typeof (raw as any).data?.id === 'string'
    ) {
      const wrapped = raw as Record<string, any>
      const flat = flattenMetaIntoItem(wrapped.data, ctx.meta)
      return { ...wrapped, data: flat }
    }
    // V2: top-level is the NoteModel itself, with next/prev as siblings.
    const { next, prev, ...note } = raw as any
    const flat = flattenMetaIntoItem(note, ctx.meta)
    const out: Record<string, unknown> = { data: flat }
    if (next !== undefined && next !== null) out.next = next
    if (prev !== undefined && prev !== null) out.prev = prev
    return out
  },
}

const AGGREGATE_TOP_REGEX = /^\/aggregate\/top$/
const aggregateTopRule: Rule = {
  match: AGGREGATE_TOP_REGEX,
  fn: (raw, ctx) => {
    if (!isPlainObject(raw)) return raw
    const stripBody = (it: any) => {
      if (!isPlainObject(it)) return it
      const { text: _t, content: _c, ...rest } = it as any
      return rest
    }
    const r = raw as any
    const withMeta = flattenNestedArrays(r, ctx.meta, ['notes', 'posts'])
    const out: Record<string, unknown> = { ...withMeta }
    if (Array.isArray(out.notes))
      out.notes = (out.notes as any[]).map(stripBody)
    if (Array.isArray(out.posts))
      out.posts = (out.posts as any[]).map(stripBody)
    return out
  },
}

const AGGREGATE_LATEST_REGEX = /^\/aggregate\/latest$/
const aggregateLatestRule: Rule = {
  match: AGGREGATE_LATEST_REGEX,
  fn: (raw, ctx) => {
    if (Array.isArray(raw)) {
      return raw.map((it) => flattenMetaIntoItem(it, ctx.meta))
    }
    if (!isPlainObject(raw)) return raw
    return flattenNestedArrays(raw, ctx.meta, ['notes', 'posts'])
  },
}

const AGGREGATE_TIMELINE_REGEX = /^\/aggregate\/timeline$/
const aggregateTimelineRule: Rule = {
  match: AGGREGATE_TIMELINE_REGEX,
  fn: (raw, ctx) => {
    if (!isPlainObject(raw)) return raw
    const r = raw as any
    if (isPlainObject(r.data)) {
      const inner = flattenNestedArrays(r.data, ctx.meta, ['notes', 'posts'])
      return { ...r, data: inner }
    }
    return flattenNestedArrays(r, ctx.meta, ['notes', 'posts'])
  },
}

const ACTIVITY_ROOMS_REGEX = /^\/activity\/rooms$/
const activityRoomsRule: Rule = {
  match: ACTIVITY_ROOMS_REGEX,
  fn: (raw, ctx) => {
    if (!isPlainObject(raw)) return raw
    const r = raw as any
    if (!isPlainObject(r.objects)) return raw
    const objects: Record<string, unknown> = { ...r.objects }
    for (const type of Object.keys(objects)) {
      if (Array.isArray(objects[type])) {
        objects[type] = (objects[type] as any[]).map((it) =>
          flattenMetaIntoItem(it, ctx.meta),
        )
      }
    }
    return { ...r, objects }
  },
}

const ACTIVITY_RECENT_REGEX = /^\/activity\/recent$/
const activityRecentRule: Rule = {
  match: ACTIVITY_RECENT_REGEX,
  fn: (raw, ctx) => {
    if (!isPlainObject(raw)) return raw
    return flattenNestedArrays(raw, ctx.meta, [
      'like',
      'comment',
      'recentPost',
      'recentNote',
      'post',
      'note',
    ])
  },
}

const READING_RANK_REGEX = /^\/activity\/reading\/(top|rank)$/
const readingRankRule: Rule = {
  match: READING_RANK_REGEX,
  fn: (raw, ctx) => {
    const items: any[] = Array.isArray(raw?.data) ? raw.data : []
    return {
      ...raw,
      data: items
        .map((it) => flattenMetaIntoItem({ ...it, id: it.refId }, ctx.meta))
        .map((it: any) => {
          const { id: _drop, ...rest } = it
          return rest
        }),
    }
  },
}

const ACTIVITY_LAST_YEAR_REGEX = /^\/activity\/last-year\/publication$/
const activityLastYearRule: Rule = {
  match: ACTIVITY_LAST_YEAR_REGEX,
  fn: (raw, ctx) => {
    if (!isPlainObject(raw)) return raw
    return flattenNestedArrays(raw, ctx.meta, ['posts', 'notes'])
  },
}

const commentUploadConfigRule: Rule = {
  match: COMMENT_UPLOAD_CONFIG_REGEX,
  fn: (raw) => {
    if (!isPlainObject(raw)) return raw
    // V2 emits `single_file_size_m_b` → camelcase → `singleFileSizeMB`;
    // V1 emitted `single_file_size_mb` → `singleFileSizeMb`.
    const r = raw as any
    if (r.singleFileSizeMB === undefined) return raw
    const { singleFileSizeMB, ...rest } = r
    return { ...rest, singleFileSizeMb: singleFileSizeMB }
  },
}

const activityPresenceRule: Rule = {
  match: ACTIVITY_PRESENCE_REGEX,
  fn: (raw) => {
    if (!isPlainObject(raw)) return raw
    const r = raw as any
    // V2 inner: { presence, readers }; V1: { data, readers }
    if ('presence' in r) {
      const { presence, ...rest } = r
      return { data: presence, ...rest }
    }
    return raw
  },
}

const noteMiddleListRule: Rule = {
  match: NOTE_MIDDLE_LIST_REGEX,
  fn: (raw) => {
    // V1: { data: [...], size }
    // V2 (after envelope unwrap): bare [...] array
    if (Array.isArray(raw)) return { data: raw, size: raw.length }
    return raw
  },
}

const noteTopicListRule: Rule = {
  match: NOTE_TOPIC_LIST_REGEX,
  fn: (raw, ctx) => {
    // Generic list flow, then strip `text` field from each note (V1 card view omitted it).
    if (!isPlainObject(raw)) return raw
    const r = raw as any
    if (!Array.isArray(r.data)) return raw
    const data = r.data.map((it: any) => {
      const flat = flattenMetaIntoItem(it, ctx.meta)
      if (flat && 'text' in flat) {
        const { text: _drop, ...rest } = flat as any
        return rest
      }
      return flat
    })
    const next: Record<string, unknown> = { ...r, data }
    if (next.pagination) next.pagination = remapPagination(next.pagination)
    else if (ctx.meta?.pagination)
      next.pagination = remapPagination(ctx.meta.pagination)
    return next
  },
}

const RULES: Rule[] = [
  commentListRule,
  commentThreadRule,
  noteDetailRule,
  commentUploadConfigRule,
  activityPresenceRule,
  noteMiddleListRule,
  noteTopicListRule,
  aggregateTopRule,
  aggregateLatestRule,
  aggregateTimelineRule,
  activityRoomsRule,
  activityRecentRule,
  readingRankRule,
  activityLastYearRule,
]

function applyRule(path: string, method: string, raw: any, meta: any) {
  for (const rule of RULES) {
    const ok =
      typeof rule.match === 'function'
        ? rule.match(path, method)
        : rule.match.test(path)
    if (ok) return rule.fn(raw, { path, method, meta })
  }
  return undefined
}

// --- top-level transform ---------------------------------------------------

function transformLegacyData<T>(
  data: T,
  meta: any,
  ctx: ResponseAdapterContext,
): T {
  // `defaultGetDataFromResponse` normally peels the V3 `{ data, meta }`
  // envelope before the adapter runs, so rules can assume inner-data. When
  // a consumer ships their own pass-through `getDataFromResponse` (common
  // with ofetch stacks that already deliver the parsed body), the envelope
  // arrives intact and rules like `aggregateTopRule` would otherwise read
  // `notes`/`posts` off the wrapper and miss them. Strip it here so the
  // rules see the same shape either way.
  const unwrapped: any =
    isPlainObject(data) && isResponseEnvelope(data) ? (data as any).data : data
  const normalizedData: any = destructureData(unwrapped)
  const path = stripPath(normalizePath(ctx.path))
  const method = ctx.method.toUpperCase()

  // Endpoint-specific rule first.
  const ruled = applyRule(path, method, normalizedData, meta)
  if (ruled !== undefined) return ruled as T

  // Generic: bare array → flatten meta into each item.
  if (Array.isArray(normalizedData)) {
    const items = normalizedData.map((it) => flattenMetaIntoItem(it, meta))
    if (meta?.pagination) {
      return {
        data: items,
        pagination: remapPagination(meta.pagination),
      } as T
    }
    return items as T
  }

  // Generic: object with array `data` → flatten meta into items, remap pagination.
  if (isPlainObject(normalizedData) && Array.isArray(normalizedData.data)) {
    const next: Record<string, unknown> = {
      ...(normalizedData as Record<string, unknown>),
      data: (normalizedData as any).data.map((it: any) =>
        flattenMetaIntoItem(it, meta),
      ),
    }
    if (next.pagination) next.pagination = remapPagination(next.pagination)
    else if (meta?.pagination)
      next.pagination = remapPagination(meta.pagination)
    return next as T
  }

  // Generic: single item → flatten meta into it.
  return flattenMetaIntoItem(normalizedData, meta) as T
}

export function legacyResponseAdapter(
  options: LegacyResponseAdapterOptions = {},
): ResponseAdapter {
  return {
    transformData(data, context) {
      if (!shouldTransform(context, options)) return data
      return transformLegacyData(data, context.meta, context)
    },
  }
}
