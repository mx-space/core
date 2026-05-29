import type { PostSortKey, SortOrder } from '../types/posts'

export function readPage(value: string | null) {
  const page = Number(value)
  return Number.isFinite(page) && page > 0 ? page : 1
}

export function readPostSortKey(value: string | null): PostSortKey {
  if (value === 'modifiedAt' || value === 'pinAt') return value
  return 'createdAt'
}

export function readSortOrder(value: string | null): SortOrder {
  return value === 'asc' ? 'asc' : 'desc'
}
