import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'

import { getNotes, searchNotes } from '~/api/notes'
import { useUrlListState } from '~/features/_shared/hooks/use-url-list-state'
import { adminQueryKeys } from '~/query/keys'

import { notesPageSize, notesQueryKey } from '../constants'
import type { NoteFilter, NoteSortKey, SortOrder } from '../types/notes'
import { getFilteredNotes } from '../utils/get-filtered-notes'
import {
  readNoteFilter,
  readNoteSortKey,
  readPage,
  readSortOrder,
} from '../utils/search-params'

interface NotesListState {
  filter: NoteFilter
  keyword: string
  page: number
  sortKey: NoteSortKey
  sortOrder: SortOrder
}

export function useNotesList() {
  const urlStateOptions = useMemo(
    () => ({
      read: (searchParams: URLSearchParams): NotesListState => ({
        filter: readNoteFilter(searchParams.get('filter')),
        keyword: searchParams.get('keyword') ?? '',
        page: readPage(searchParams.get('page')),
        sortKey: readNoteSortKey(searchParams.get('sort')),
        sortOrder: readSortOrder(searchParams.get('order')),
      }),
      write: (state: NotesListState) => {
        const nextParams = new URLSearchParams()
        if (state.page > 1) nextParams.set('page', String(state.page))
        if (state.keyword) nextParams.set('keyword', state.keyword)
        if (state.filter !== 'all') nextParams.set('filter', state.filter)
        if (state.sortKey !== 'createdAt') nextParams.set('sort', state.sortKey)
        if (state.sortOrder !== 'desc') nextParams.set('order', state.sortOrder)
        return nextParams
      },
    }),
    [],
  )

  const [state, setState] = useUrlListState(urlStateOptions)
  const [keywordInput, setKeywordInput] = useState(state.keyword)

  useEffect(() => {
    setKeywordInput(state.keyword)
  }, [state.keyword])

  const notesQuery = useQuery({
    placeholderData: (previous) => previous,
    queryFn: () =>
      state.keyword
        ? searchNotes({
            keyword: state.keyword,
            page: state.page,
            size: notesPageSize,
          })
        : state.filter === 'all'
          ? getNotes({
              page: state.page,
              size: notesPageSize,
              sort_by: state.sortKey,
              sort_order: state.sortOrder,
            })
          : getFilteredNotes({
              filter: state.filter,
              page: state.page,
              size: notesPageSize,
              sortKey: state.sortKey,
              sortOrder: state.sortOrder,
            }),
    queryKey: adminQueryKeys.notes.list({
      filter: state.filter,
      keyword: state.keyword,
      page: state.page,
      size: notesPageSize,
      sortKey: state.sortKey,
      sortOrder: state.sortOrder,
    }),
  })

  return {
    clearSearch: () => {
      setKeywordInput('')
      setState((current) => ({ ...current, keyword: '', page: 1 }))
    },
    filter: state.filter,
    keyword: state.keyword,
    keywordInput,
    notes: notesQuery.data?.data ?? [],
    notesQuery,
    page: state.page,
    pagination: notesQuery.data?.pagination,
    rootQueryKey: notesQueryKey,
    setFilter: (filter: NoteFilter) =>
      setState((current) => ({ ...current, filter, page: 1 })),
    setKeywordInput,
    setPage: (page: number) => setState({ page }),
    setSort: (next: { field: NoteSortKey; order: SortOrder }) =>
      setState((current) => ({
        ...current,
        page: 1,
        sortKey: next.field,
        sortOrder: next.order,
      })),
    sortKey: state.sortKey,
    sortOrder: state.sortOrder,
    submitSearch: () =>
      setState((current) => ({
        ...current,
        keyword: keywordInput.trim(),
        page: 1,
      })),
  }
}
