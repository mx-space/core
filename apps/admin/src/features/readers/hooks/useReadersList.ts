import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'

import type { ReaderRoleFilter } from '~/api/readers'
import { getReaders } from '~/api/readers'
import { useUrlListState } from '~/features/_shared/hooks/use-url-list-state'
import { adminQueryKeys } from '~/query/keys'

import {
  readersPageSize,
  readersQueryKey,
  searchDebounceMs,
} from '../constants'

function parseRole(value: string | null): ReaderRoleFilter {
  if (value === 'owner' || value === 'reader') return value
  return 'all'
}

function parsePage(value: string | null): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 1 ? parsed : 1
}

export function useReadersList() {
  const urlStateOptions = useMemo(
    () => ({
      read: (searchParams: URLSearchParams) => ({
        page: parsePage(searchParams.get('page')),
        role: parseRole(searchParams.get('role')),
        search: searchParams.get('q') ?? '',
      }),
      write: (state: {
        page: number
        role: ReaderRoleFilter
        search: string
      }) => {
        const nextParams = new URLSearchParams()
        if (state.role !== 'all') nextParams.set('role', state.role)
        if (state.search) nextParams.set('q', state.search)
        if (state.page > 1) nextParams.set('page', String(state.page))
        return nextParams
      },
    }),
    [],
  )

  const [state, setState] = useUrlListState(urlStateOptions)
  const [debouncedSearch, setDebouncedSearch] = useState(state.search)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(state.search)
    }, searchDebounceMs)

    return () => window.clearTimeout(timer)
  }, [state.search])

  const readersQuery = useQuery({
    placeholderData: keepPreviousData,
    queryFn: () =>
      getReaders({
        page: state.page,
        role: state.role === 'all' ? undefined : state.role,
        search: debouncedSearch.trim() || undefined,
        size: readersPageSize,
      }),
    queryKey: adminQueryKeys.readers.list({
      page: state.page,
      role: state.role,
      search: debouncedSearch.trim(),
      size: readersPageSize,
    }),
  })

  const changeSearch = (value: string) => {
    setState((current) => ({ ...current, page: 1, search: value }))
  }

  const changeRole = (value: ReaderRoleFilter) => {
    setState((current) => ({ ...current, page: 1, role: value }))
  }

  const listQueryString = urlStateOptions.write(state).toString()

  return {
    isFetching: readersQuery.isFetching,
    isLoading: readersQuery.isLoading,
    listQueryString,
    page: state.page,
    pagination: readersQuery.data?.pagination,
    readers: readersQuery.data?.data ?? [],
    refetch: () => void readersQuery.refetch(),
    role: state.role,
    search: state.search,
    setPage: (page: number) => setState({ page }),
    setRole: changeRole,
    setSearch: changeSearch,
  }
}
