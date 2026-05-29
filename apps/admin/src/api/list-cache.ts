import type { QueryClient, QueryKey } from '@tanstack/react-query'

/**
 * 自 TanStack Query cache 之 list 数据中检索 id 对应 entity，供 detail 之 useQuery
 * `initialData` 用，免 push transition 间 loading flash。
 *
 * `listQueryKey` 为 list 之 base key（如 `['drafts']`），所有以此为前缀之 cache entry
 * （含不同 filter / pagination）皆扫，故 hit rate 高。
 *
 * `extractItems` 自 cache value 中拽出 entity 数组：默认尝试 `.data.list` /
 * `.data.items` / `.list` / `.items` / `.data` / 顶层数组。复杂结构可显式传。
 */
export function findInListCache<T>(
  qc: QueryClient,
  listQueryKey: QueryKey,
  id: string,
  options?: {
    idField?: keyof T
    extractItems?: (cacheValue: unknown) => T[] | undefined
  },
): T | undefined {
  const idField = options?.idField ?? ('id' as keyof T)
  const extract = options?.extractItems ?? defaultExtractItems
  const entries = qc.getQueriesData({ queryKey: listQueryKey })
  for (const [, data] of entries) {
    const items = extract(data) as T[] | undefined
    if (!items) continue
    const hit = items.find(
      (item) => item != null && String(item[idField]) === String(id),
    )
    if (hit) return hit
  }
  return undefined
}

function defaultExtractItems(value: unknown): unknown[] | undefined {
  if (value == null) return undefined
  if (Array.isArray(value)) return value
  if (typeof value !== 'object') return undefined
  const obj = value as Record<string, unknown>
  const candidates = [
    (obj.data as Record<string, unknown> | undefined)?.list,
    (obj.data as Record<string, unknown> | undefined)?.items,
    obj.list,
    obj.items,
    obj.data,
  ]
  for (const c of candidates) {
    if (Array.isArray(c)) return c
  }
  return undefined
}

/**
 * `initialDataUpdatedAt` helper — 视 initialData 为"刚 fetch"。无此则 React Query
 * 会立即 background refetch 致 detail 闪 loading。扫所有匹配 list query 之
 * `dataUpdatedAt`，返最大者；皆无则 `Date.now()`。
 */
export function listCacheUpdatedAt(
  qc: QueryClient,
  listQueryKey: QueryKey,
): number {
  let max = 0
  for (const query of qc.getQueryCache().findAll({ queryKey: listQueryKey })) {
    const t = query.state.dataUpdatedAt
    if (t > max) max = t
  }
  return max || Date.now()
}
