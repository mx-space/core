import { Context, Effect, Layer } from 'effect'

import { Generic, ResourceNotFound, ValidationFailed } from '../domain/errors'
import { Api, type ApiError, type ApiService } from './Api'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ResolverKind = 'category' | 'topic'

export interface ResolvableItem {
  readonly id: string
  readonly slug?: string
  readonly name?: string
}

export interface ResolverService {
  /** Resolve a slug/name/id to an id. Snowflake ids pass through unchanged. */
  readonly resolveCategory: (
    value: string,
  ) => Effect.Effect<string, ValidationFailed | Generic>
  readonly resolveTopic: (
    value: string,
  ) => Effect.Effect<string, ValidationFailed | Generic>
  /** Resolve a list of refs (category slugs/ids) to ids. */
  readonly resolveCategoryRefs: (
    refs: ReadonlyArray<string>,
  ) => Effect.Effect<ReadonlyArray<string>, ValidationFailed | Generic>
  /** Resolve a post slug/id to a snowflake id. */
  readonly resolvePostId: (
    slugOrId: string,
  ) => Effect.Effect<string, ResourceNotFound | ValidationFailed | Generic>
  /** Build the read path (`/posts/<category>/<slug>` or `/posts/<id>`). */
  readonly resolvePostReadPath: (
    slugOrId: string,
  ) => Effect.Effect<string, ResourceNotFound | ValidationFailed | Generic>
  /** Resolve a note slug or numeric nid to its snowflake id. */
  readonly resolveNoteId: (
    slugOrId: string,
  ) => Effect.Effect<string, ResourceNotFound | ValidationFailed | Generic>
  /** Resolve a category slug to its snowflake id (via /categories/:slug). */
  readonly resolveCategoryId: (
    slugOrId: string,
  ) => Effect.Effect<string, ResourceNotFound | ValidationFailed | Generic>
  /** Bust cache for a given kind, or all if omitted. */
  readonly invalidate: (kind?: ResolverKind) => Effect.Effect<void>
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

const SNOWFLAKE_RE = /^\d{15,}$/
export const isSnowflakeId = (value: string): boolean =>
  SNOWFLAKE_RE.test(value)

export function matchItem(
  items: ReadonlyArray<ResolvableItem>,
  value: string,
): ResolvableItem | null {
  const bySlug = items.find((i) => i.slug && i.slug === value)
  if (bySlug) return bySlug
  const byName = items.find((i) => i.name && i.name === value)
  if (byName) return byName
  const lower = value.toLowerCase()
  const byNameCi = items.find((i) => i.name && i.name.toLowerCase() === lower)
  if (byNameCi) return byNameCi
  const bySlugCi = items.find((i) => i.slug && i.slug.toLowerCase() === lower)
  if (bySlugCi) return bySlugCi
  return null
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const m = a.length
  const n = b.length
  let prev = Array.from<number>({ length: n + 1 })
  let curr = Array.from<number>({ length: n + 1 })
  for (let j = 0; j <= n; j++) prev[j] = j
  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1
      curr[j] = Math.min(
        (curr[j - 1] ?? 0) + 1,
        (prev[j] ?? 0) + 1,
        (prev[j - 1] ?? 0) + cost,
      )
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[n] ?? 0
}

export function fuzzySuggest(
  items: ReadonlyArray<ResolvableItem>,
  value: string,
  maxDistance = 2,
): string[] {
  const lower = value.toLowerCase()
  const scored: { label: string; score: number }[] = []
  for (const item of items) {
    const candidates: string[] = []
    if (item.name) candidates.push(item.name)
    if (item.slug) candidates.push(item.slug)
    let best = Number.POSITIVE_INFINITY
    let label = item.name ?? item.slug ?? item.id
    for (const c of candidates) {
      const d = levenshtein(c.toLowerCase(), lower)
      if (d < best) {
        best = d
        label = c
      }
    }
    if (best <= maxDistance) scored.push({ label, score: best })
  }
  scored.sort((a, b) => a.score - b.score)
  return scored.slice(0, 3).map((s) => s.label)
}

// ---------------------------------------------------------------------------
// Service factory
// ---------------------------------------------------------------------------

const DEFAULT_TTL_MS = 60_000

interface CacheEntry {
  expiresAt: number
  items: ResolvableItem[]
}

interface ApiEnvelopeFlat {
  data?: unknown
}

const unwrapArrayEnvelope = (raw: unknown): ResolvableItem[] => {
  if (Array.isArray(raw)) return raw as ResolvableItem[]
  if (raw && typeof raw === 'object') {
    const inner = (raw as ApiEnvelopeFlat).data
    if (Array.isArray(inner)) return inner as ResolvableItem[]
  }
  return []
}

const mapApiError = (err: ApiError): Generic | ValidationFailed => {
  // Network/Auth/Server errors are surfaced as Generic; Validation passes through.
  if (err._tag === 'ValidationFailed') return err
  // Wrap everything else as Generic to satisfy the narrowed return channel.
  // (We intentionally do NOT swallow — caller still sees a typed error.)
  return new Generic({
    message:
      (err as { message?: string }).message ?? 'resolver: api request failed',
    details: (err as { details?: unknown }).details,
    hint: (err as { hint?: string }).hint,
  })
}

export interface ResolverDeps {
  readonly ttlMs?: number
}

export const make = (
  api: ApiService,
  deps: ResolverDeps = {},
): ResolverService => {
  const cache = new Map<string, CacheEntry>()
  const ttlMs = deps.ttlMs ?? DEFAULT_TTL_MS

  const load = (
    kind: 'category' | 'topic',
  ): Effect.Effect<ResolvableItem[], ValidationFailed | Generic> =>
    Effect.gen(function* () {
      const cached = cache.get(kind)
      const t = Date.now()
      if (cached && cached.expiresAt > t) return cached.items
      const url = kind === 'category' ? '/categories' : '/topics/all'
      const raw = yield* api.raw(url).pipe(Effect.mapError(mapApiError))
      const items = unwrapArrayEnvelope(raw)
      cache.set(kind, { items, expiresAt: t + ttlMs })
      return items
    })

  const resolveWith = (
    kind: 'category' | 'topic',
    value: string,
  ): Effect.Effect<string, ValidationFailed | Generic> =>
    Effect.gen(function* () {
      if (isSnowflakeId(value)) return value
      const items = yield* load(kind)
      const hit = matchItem(items, value)
      if (hit) return hit.id
      const suggestions = fuzzySuggest(items, value)
      return yield* Effect.fail(
        new ValidationFailed({
          message: `${kind} "${value}" not found`,
          details: {
            issues: [
              {
                path: ['meta', kind],
                message: 'not found',
                ...(suggestions.length ? { suggestions } : {}),
              },
            ],
          },
          hint:
            kind === 'category'
              ? 'run `mxs category list` to see available categories'
              : 'run `mxs topic list` to see available topics',
        }),
      )
    })

  const resolveCategory = (value: string) => resolveWith('category', value)
  const resolveTopic = (value: string) => resolveWith('topic', value)

  const resolveCategoryRefs = (
    refs: ReadonlyArray<string>,
  ): Effect.Effect<ReadonlyArray<string>, ValidationFailed | Generic> =>
    Effect.forEach(refs, (ref) => resolveCategory(ref), { concurrency: 1 })

  // -- Post / Note / Category direct API resolvers (port of commands/*/resolve.ts)

  const resolvePostReadPath = (
    slugOrId: string,
  ): Effect.Effect<string, ResourceNotFound | ValidationFailed | Generic> =>
    Effect.gen(function* () {
      if (isSnowflakeId(slugOrId)) return `/posts/${slugOrId}`
      const raw = yield* api
        .raw(`/posts/get-url/${encodeURIComponent(slugOrId)}`)
        .pipe(Effect.mapError(mapApiError))
      const env = raw as { data?: { path?: string }; path?: string } | undefined
      const path = env?.data?.path ?? env?.path
      if (!path) {
        return yield* Effect.fail(
          new ResourceNotFound({
            message: `post not found: ${slugOrId}`,
            kind: 'post',
            ref: slugOrId,
          }),
        )
      }
      return `/posts${path.startsWith('/') ? path : `/${path}`}`
    })

  const resolvePostId = (
    slugOrId: string,
  ): Effect.Effect<string, ResourceNotFound | ValidationFailed | Generic> =>
    Effect.gen(function* () {
      if (isSnowflakeId(slugOrId)) return slugOrId
      const apiPath = yield* resolvePostReadPath(slugOrId)
      const raw = yield* api.raw(apiPath).pipe(Effect.mapError(mapApiError))
      const env = raw as { data?: { id?: string }; id?: string } | undefined
      const id = env?.data?.id ?? env?.id
      if (!id) {
        return yield* Effect.fail(
          new ResourceNotFound({
            message: `post not found: ${slugOrId}`,
            kind: 'post',
            ref: slugOrId,
          }),
        )
      }
      return id
    })

  const resolveNoteId = (
    slugOrId: string,
  ): Effect.Effect<string, ResourceNotFound | ValidationFailed | Generic> =>
    Effect.gen(function* () {
      if (isSnowflakeId(slugOrId)) return slugOrId
      if (/^\d+$/.test(slugOrId)) {
        const raw = yield* api
          .raw(`/notes/nid/${encodeURIComponent(slugOrId)}`, {
            query: { single: '1' },
          })
          .pipe(Effect.mapError(mapApiError))
        const env = raw as { data?: { id?: string }; id?: string } | undefined
        const id = env?.data?.id ?? env?.id
        if (!id) {
          return yield* Effect.fail(
            new ResourceNotFound({
              message: `note not found: ${slugOrId}`,
              kind: 'note',
              ref: slugOrId,
            }),
          )
        }
        return id
      }
      return yield* Effect.fail(
        new ValidationFailed({
          message: `invalid note reference: ${slugOrId} (use snowflake id or numeric nid)`,
        }),
      )
    })

  const resolveCategoryId = (
    slugOrId: string,
  ): Effect.Effect<string, ResourceNotFound | ValidationFailed | Generic> =>
    Effect.gen(function* () {
      if (isSnowflakeId(slugOrId)) return slugOrId
      const raw = yield* api
        .raw(`/categories/${encodeURIComponent(slugOrId)}`)
        .pipe(Effect.mapError(mapApiError))
      const id = (raw as { data?: { id?: string } } | undefined)?.data?.id
      if (!id) {
        return yield* Effect.fail(
          new ResourceNotFound({
            message: `category not found: ${slugOrId}`,
            kind: 'category',
            ref: slugOrId,
          }),
        )
      }
      return id
    })

  const invalidate = (kind?: ResolverKind): Effect.Effect<void> =>
    Effect.sync(() => {
      if (!kind) {
        cache.clear()
        return
      }
      cache.delete(kind)
    })

  return {
    resolveCategory,
    resolveTopic,
    resolveCategoryRefs,
    resolvePostId,
    resolvePostReadPath,
    resolveNoteId,
    resolveCategoryId,
    invalidate,
  }
}

// ---------------------------------------------------------------------------
// Tag + Layer
// ---------------------------------------------------------------------------

export class Resolver extends Context.Tag('Resolver')<
  Resolver,
  ResolverService
>() {
  /**
   * Default layer composes `Resolver` from the ambient `Api` service. Tests can
   * provide an alternate layer via {@link layer}.
   */
  static Default: Layer.Layer<Resolver, never, Api> = Layer.effect(
    Resolver,
    Effect.gen(function* () {
      const api = yield* Api
      return make(api)
    }),
  )
}

/** Build a Resolver layer from an explicit `ApiService` (tests). */
export const layer = (
  api: ApiService,
  deps: ResolverDeps = {},
): Layer.Layer<Resolver> => Layer.succeed(Resolver, make(api, deps))
