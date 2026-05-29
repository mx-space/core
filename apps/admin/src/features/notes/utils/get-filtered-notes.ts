import type { PaginateResult } from '~/models/base'
import type { NoteModel } from '~/models/note'
import type { NoteFilter, NoteSortKey, SortOrder } from '../types/notes'

import { getNotes } from '~/api/notes'

import { filteredNotesFetchSize } from '../constants'

export async function getFilteredNotes(params: {
  filter: Exclude<NoteFilter, 'all'>
  page: number
  size: number
  sortKey: NoteSortKey
  sortOrder: SortOrder
}): Promise<PaginateResult<NoteModel>> {
  const firstPage = await getNotes({
    page: 1,
    size: filteredNotesFetchSize,
    sort_by: params.sortKey,
    sort_order: params.sortOrder,
  })
  const remainingPages = Array.from(
    { length: Math.max(firstPage.pagination.totalPages - 1, 0) },
    (_, index) => index + 2,
  )
  const remainingResults = await Promise.all(
    remainingPages.map((page) =>
      getNotes({
        page,
        size: filteredNotesFetchSize,
        sort_by: params.sortKey,
        sort_order: params.sortOrder,
      }),
    ),
  )
  const filteredNotes = [firstPage, ...remainingResults]
    .flatMap((result) => result.data)
    .filter((note) =>
      params.filter === 'bookmark' ? note.bookmark : !note.isPublished,
    )
  const start = (params.page - 1) * params.size
  const totalPages = Math.max(1, Math.ceil(filteredNotes.length / params.size))

  return {
    data: filteredNotes.slice(start, start + params.size),
    pagination: {
      page: params.page,
      size: params.size,
      total: filteredNotes.length,
      totalPages,
    },
  }
}
