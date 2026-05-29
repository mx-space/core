import type { NoteFilter, NoteSortKey, SortOrder } from '../types/notes'

export function readPage(value: string | null) {
  const page = Number(value)
  return Number.isFinite(page) && page > 0 ? page : 1
}

export function readNoteFilter(value: string | null): NoteFilter {
  if (value === 'bookmark' || value === 'unpublished') return value
  return 'all'
}

export function readNoteSortKey(value: string | null): NoteSortKey {
  if (
    value === 'modifiedAt' ||
    value === 'mood' ||
    value === 'title' ||
    value === 'weather'
  ) {
    return value
  }
  return 'createdAt'
}

export function readSortOrder(value: string | null): SortOrder {
  return value === 'asc' ? 'asc' : 'desc'
}
