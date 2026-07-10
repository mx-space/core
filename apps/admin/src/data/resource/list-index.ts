import type { Pager } from '~/models/base'

import type { Collection, CollectionState } from './collection'

export interface ListIndex {
  ids: string[]
  pagination?: Pager
  updatedAt: number
  lruAt: number
}

export interface ListPage<T> {
  items: T[]
  pagination?: Pager
}

const MAX_LIST_KEYS = 50

export interface HydrateListOptions {
  mode?: 'append' | 'replace'
}

function dedupeConcat(existingIds: string[], incomingIds: string[]): string[] {
  const seen = new Set(existingIds)
  const appended = incomingIds.filter((id) => {
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
  return [...existingIds, ...appended]
}

export function hydrateList<T extends object>(
  collection: Collection<T>,
  listKey: string,
  page: ListPage<T>,
  options?: HydrateListOptions,
): void {
  collection.hydrate(page.items)

  const incomingIds = page.items.map((item) => collection.getKey(item))
  const mode = options?.mode ?? 'replace'
  const now = Date.now()

  collection.store.setState((state) => {
    const existing = state.listIndexes[listKey]
    const ids =
      mode === 'append' && existing
        ? dedupeConcat(existing.ids, incomingIds)
        : incomingIds

    const listIndexes = {
      ...state.listIndexes,
      [listKey]: {
        ids,
        pagination: page.pagination,
        updatedAt: now,
        lruAt: now,
      },
    }
    return { listIndexes: evictOverflow(listIndexes) }
  })
}

function evictOverflow(
  listIndexes: Record<string, ListIndex>,
): Record<string, ListIndex> {
  const keys = Object.keys(listIndexes)
  if (keys.length <= MAX_LIST_KEYS) return listIndexes

  const sortedByLru = keys.sort(
    (a, b) => listIndexes[a].lruAt - listIndexes[b].lruAt,
  )
  const evictCount = keys.length - MAX_LIST_KEYS
  const evicted = new Set(sortedByLru.slice(0, evictCount))

  const next: Record<string, ListIndex> = {}
  for (const key of keys) {
    if (!evicted.has(key)) next[key] = listIndexes[key]
  }
  return next
}

export function readList<T extends object>(
  state: CollectionState<T>,
  _collection: Collection<T>,
  listKey: string,
): { ids: string[]; pagination?: Pager; updatedAt: number } | undefined {
  const index = state.listIndexes[listKey]
  if (!index) return undefined
  return {
    ids: index.ids,
    pagination: index.pagination,
    updatedAt: index.updatedAt,
  }
}

export function touchList<T extends object>(
  collection: Collection<T>,
  listKey: string,
): void {
  collection.store.setState((state) => {
    const index = state.listIndexes[listKey]
    if (!index) return state
    return {
      listIndexes: {
        ...state.listIndexes,
        [listKey]: { ...index, lruAt: Date.now() },
      },
    }
  })
}
