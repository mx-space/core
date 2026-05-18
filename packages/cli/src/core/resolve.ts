import { MxsError, MxsErrorCode } from './errors'

export interface ResolvableItem {
  id: string
  slug?: string
  name?: string
}

export interface ResolverFetchers {
  fetchCategories?: () => Promise<ResolvableItem[]>
  fetchTopics?: () => Promise<ResolvableItem[]>
}

interface CacheEntry {
  expiresAt: number
  items: ResolvableItem[]
}

const SNOWFLAKE_RE = /^\d{15,}$/

export function isSnowflakeId(value: string): boolean {
  return SNOWFLAKE_RE.test(value)
}

export class NameResolver {
  private cache = new Map<string, CacheEntry>()
  private ttlMs: number

  constructor(
    private fetchers: ResolverFetchers,
    { ttlMs = 60_000 }: { ttlMs?: number } = {},
  ) {
    this.ttlMs = ttlMs
  }

  async resolveCategory(value: string): Promise<string> {
    return this.resolveWith('category', value, this.fetchers.fetchCategories)
  }

  async resolveTopic(value: string): Promise<string> {
    return this.resolveWith('topic', value, this.fetchers.fetchTopics)
  }

  invalidate(kind?: string): void {
    if (!kind) {
      this.cache.clear()
      return
    }
    this.cache.delete(kind)
  }

  private async resolveWith(
    kind: 'category' | 'topic',
    value: string,
    fetcher: (() => Promise<ResolvableItem[]>) | undefined,
  ): Promise<string> {
    if (isSnowflakeId(value)) return value
    if (!fetcher) {
      throw new MxsError({
        code: MxsErrorCode.ValidationFailed,
        message: `cannot resolve ${kind}: no fetcher configured`,
      })
    }
    const items = await this.load(kind, fetcher)
    const hit = matchItem(items, value)
    if (hit) return hit.id
    const suggestions = fuzzySuggest(items, value)
    throw new MxsError({
      code: MxsErrorCode.ValidationFailed,
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
    })
  }

  private async load(
    kind: string,
    fetcher: () => Promise<ResolvableItem[]>,
  ): Promise<ResolvableItem[]> {
    const cached = this.cache.get(kind)
    const now = Date.now()
    if (cached && cached.expiresAt > now) return cached.items
    const items = await fetcher()
    this.cache.set(kind, { items, expiresAt: now + this.ttlMs })
    return items
  }
}

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
