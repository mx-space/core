/**
 * Shared assertion helpers used by API contract tests.
 *
 * Goal: catch any regression where a controller leaks a Mongo-shape field
 * (e.g. `_id`, `created`, `modified`, `count.{read,like}`) on a response that
 * the api-client/dashboard expects to be PG-shape (`id`, `created_at`,
 * `modified_at`, `read_count`, `like_count`).
 *
 * Note: `JSONTransformInterceptor` lowercases every key to `snake_case`
 * before the response leaves the server, so legacy keys appear in tests
 * exactly as they would in api-client. This module checks BOTH camelCase
 * (raw) and snake_case (post-transform) forms so callers can use it on
 * either pre- or post-interceptor data.
 */

/**
 * Default forbidden keys (snake_case forms used by the JSON transform).
 * Each key represents a Mongo-shape field that MUST NOT appear on PG-shape
 * responses for any of the migrated entities listed in the contract suite.
 */
const DEFAULT_FORBIDDEN_KEYS = new Set<string>([
  '_id',
  'created',
  'modified',
  'comments_index',
  'allow_comment',
])

/**
 * Keys that are forbidden only when the value matches a legacy shape.
 * For example, top-level `count: { read, like }` is the legacy Mongo shape;
 * post-migration the response should use `read_count` / `like_count`.
 */
type ConditionalCheck = (value: unknown) => boolean

const CONDITIONAL_FORBIDDEN: Record<string, ConditionalCheck> = {
  count: (value) => {
    if (!value || typeof value !== 'object') return false
    const obj = value as Record<string, unknown>
    return 'read' in obj || 'like' in obj
  },
}

export type LegacyKeyOpts = {
  /**
   * Keys that are legitimately PRESENT on this entity (default empty).
   * Pass snake_case form, e.g. `['comments_index', 'allow_comment']` for
   * `recently`, or `['pin']` for `comment` where `pin: boolean` is valid.
   */
  allowed?: string[]
}

/**
 * Recursively walk `value`. Throw if any object key matches a legacy
 * Mongo-shape name (see {@link DEFAULT_FORBIDDEN_KEYS} and
 * {@link CONDITIONAL_FORBIDDEN}).
 *
 * `opts.allowed` lets a caller permit a specific legacy-named field for an
 * entity that legitimately has it (e.g. `recently` has `comments_index`).
 */
export function assertNoLegacyKeys(
  value: unknown,
  opts: LegacyKeyOpts = {},
  path = '$',
): void {
  if (value === null || value === undefined) return
  if (typeof value !== 'object') return

  const allowed = new Set(opts.allowed ?? [])

  if (Array.isArray(value)) {
    value.forEach((item, idx) =>
      assertNoLegacyKeys(item, opts, `${path}[${idx}]`),
    )
    return
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (allowed.has(key)) {
      // Caller explicitly permits this legacy name on this entity; still
      // recurse to check nested objects.
      assertNoLegacyKeys(child, opts, `${path}.${key}`)
      continue
    }

    if (DEFAULT_FORBIDDEN_KEYS.has(key)) {
      throw new Error(
        `Legacy key "${key}" found at ${path}. ` +
          `Migrated entities must not expose Mongo-shape fields.`,
      )
    }

    const conditional = CONDITIONAL_FORBIDDEN[key]
    if (conditional && conditional(child)) {
      throw new Error(
        `Legacy shape for "${key}" found at ${path}: value matches Mongo-style ` +
          `count: { read, like }. Migrated entities must use read_count / like_count.`,
      )
    }

    assertNoLegacyKeys(child, opts, `${path}.${key}`)
  }
}

/**
 * Assert presence + correct shape for the common timestamp/identity fields
 * on a single PG-shape entity (post snake_case-transform: `id`, `created_at`,
 * `modified_at`).
 *
 * Pass an item picked from `body.data?.[0]` or `body` directly. Missing
 * `modified_at` is tolerated when the value is null (some entities can have
 * never been modified), but the KEY itself must be present so the contract
 * stays explicit.
 */
export function assertPgTimestamps(
  value: Record<string, unknown> | undefined | null,
): void {
  if (!value || typeof value !== 'object') {
    throw new Error(
      'assertPgTimestamps: expected an object, got ' + typeof value,
    )
  }

  if (!('id' in value)) {
    throw new Error('assertPgTimestamps: missing `id` on entity')
  }

  if (!('created_at' in value)) {
    throw new Error('assertPgTimestamps: missing `created_at` on entity')
  }

  // Forbid the legacy aliases by name (defensive — assertNoLegacyKeys would
  // also catch this, but make the failure message specific to timestamps).
  for (const legacy of ['_id', 'created', 'modified'] as const) {
    if (legacy in value) {
      throw new Error(
        `assertPgTimestamps: legacy timestamp field "${legacy}" present on entity`,
      )
    }
  }
}

/**
 * Assert that any `ref_type` strings appearing inside `value` use the
 * lowercase singular form (`'post'`, `'note'`, `'page'`, `'recently'`).
 *
 * Forbidden as VALUES: `'Post'`, `'Posts'`, `'Note'`, `'Notes'`,
 * `'Recently'`, `'Recentlies'`, `'Page'`, `'Pages'`. (Enum member names
 * may legitimately use these; this checks string values only.)
 */
const FORBIDDEN_REF_TYPE_VALUES = new Set([
  'Post',
  'Posts',
  'posts',
  'Note',
  'Notes',
  'notes',
  'Page',
  'Pages',
  'pages',
  'Recently',
  'Recentlies',
  'recentlies',
])

/**
 * Assert that `value` (post-snakecase response body or any nested object)
 * has every key in `requiredKeys` present and not `undefined`.
 *
 * Use for flat field-presence checks. Pass keys exactly as they appear in the
 * snake_case response body, e.g. `['id', 'created_at', 'read_count']`.
 *
 * `null` is considered PRESENT (legitimate "no value yet"). Only `undefined`
 * or a missing key triggers a failure.
 */
export function assertHasKeys(
  value: Record<string, unknown> | undefined | null,
  requiredKeys: string[],
): void {
  if (!value || typeof value !== 'object') {
    throw new Error(
      `assertHasKeys: expected an object, got ${value === null ? 'null' : typeof value}`,
    )
  }
  const missing: string[] = []
  for (const key of requiredKeys) {
    if (
      !(key in value) ||
      (value as Record<string, unknown>)[key] === undefined
    ) {
      missing.push(key)
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `assertHasKeys: missing required keys [${missing.map((k) => `"${k}"`).join(', ')}] on entity. ` +
        `Present keys: [${Object.keys(value)
          .map((k) => `"${k}"`)
          .join(', ')}]`,
    )
  }
}

/**
 * Like {@link assertHasKeys} but supports dotted/indexed paths to walk nested
 * structure: `'category.slug'`, `'related.0.title'`, `'data.0.id'`, etc.
 *
 * Path segments that are all-digits are treated as array indices.
 *
 * `null` at any intermediate or terminal step counts as MISSING (because you
 * cannot read `.foo` off `null`). Use when the consumer dereferences nested
 * fields without optional-chaining.
 */
export function assertHasKeysDeep(value: unknown, paths: string[]): void {
  if (value === null || value === undefined || typeof value !== 'object') {
    throw new Error(
      `assertHasKeysDeep: expected a non-null object, got ${value === null ? 'null' : typeof value}`,
    )
  }
  const missing: string[] = []
  for (const path of paths) {
    const segments = path.split('.')
    let cursor: unknown = value
    let walked = ''
    let ok = true
    for (const seg of segments) {
      walked = walked ? `${walked}.${seg}` : seg
      if (cursor === null || cursor === undefined) {
        ok = false
        break
      }
      if (Array.isArray(cursor)) {
        const idx = Number(seg)
        if (!Number.isInteger(idx)) {
          ok = false
          break
        }
        cursor = cursor[idx]
      } else if (typeof cursor === 'object') {
        cursor = (cursor as Record<string, unknown>)[seg]
      } else {
        ok = false
        break
      }
      if (cursor === undefined) {
        ok = false
        break
      }
    }
    if (!ok || cursor === undefined) {
      missing.push(path)
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `assertHasKeysDeep: missing required paths [${missing.map((p) => `"${p}"`).join(', ')}].`,
    )
  }
}

export function assertLowercaseRefType(value: unknown, path = '$'): void {
  if (value === null || value === undefined) return
  if (typeof value !== 'object') return

  if (Array.isArray(value)) {
    value.forEach((item, idx) =>
      assertLowercaseRefType(item, `${path}[${idx}]`),
    )
    return
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (
      (key === 'ref_type' || key === 'refType') &&
      typeof child === 'string' &&
      FORBIDDEN_REF_TYPE_VALUES.has(child)
    ) {
      throw new Error(
        `Legacy ref_type value "${child}" found at ${path}.${key}. ` +
          `Use lowercase singular: 'post' | 'note' | 'page' | 'recently'.`,
      )
    }
    assertLowercaseRefType(child, `${path}.${key}`)
  }
}
