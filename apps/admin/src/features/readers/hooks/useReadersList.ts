import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useLayoutEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import type { ReaderRoleFilter } from '~/api/readers'

import { getReaders } from '~/api/readers'

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
  const [searchParams, setSearchParams] = useSearchParams()
  const searchParamsKey = searchParams.toString()

  const [page, setPage] = useState(() => parsePage(searchParams.get('page')))
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '')
  const [role, setRole] = useState<ReaderRoleFilter>(() =>
    parseRole(searchParams.get('role')),
  )
  const [detailId, setDetailId] = useState<string | null>(() =>
    searchParams.get('id'),
  )
  const [showDetailOnMobile, setShowDetailOnMobile] = useState(false)
  const [debouncedSearch, setDebouncedSearch] = useState(search)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search)
    }, searchDebounceMs)

    return () => window.clearTimeout(timer)
  }, [search])

  const readersQuery = useQuery({
    placeholderData: keepPreviousData,
    queryFn: () =>
      getReaders({
        page,
        role: role === 'all' ? undefined : role,
        search: debouncedSearch.trim() || undefined,
        size: readersPageSize,
      }),
    queryKey: [
      ...readersQueryKey,
      'list',
      page,
      readersPageSize,
      debouncedSearch.trim(),
      role,
    ],
  })

  useLayoutEffect(() => {
    const nextRole = parseRole(searchParams.get('role'))
    const nextSearch = searchParams.get('q') ?? ''
    const nextPage = parsePage(searchParams.get('page'))
    const nextDetailId = searchParams.get('id')

    setRole((value) => (value === nextRole ? value : nextRole))
    setSearch((value) => (value === nextSearch ? value : nextSearch))
    setPage((value) => (value === nextPage ? value : nextPage))
    setDetailId((value) => (value === nextDetailId ? value : nextDetailId))
    setShowDetailOnMobile(Boolean(nextDetailId))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParamsKey])

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams)

    if (role === 'all') nextParams.delete('role')
    else nextParams.set('role', role)

    if (search) nextParams.set('q', search)
    else nextParams.delete('q')

    if (page > 1) nextParams.set('page', String(page))
    else nextParams.delete('page')

    if (detailId) nextParams.set('id', detailId)
    else nextParams.delete('id')

    if (nextParams.toString() !== searchParamsKey) {
      setSearchParams(nextParams, { replace: true })
    }
  }, [
    role,
    search,
    page,
    detailId,
    searchParams,
    searchParamsKey,
    setSearchParams,
  ])

  const changeSearch = (value: string) => {
    setSearch(value)
    setPage(1)
    setDetailId(null)
  }

  const changeRole = (value: ReaderRoleFilter) => {
    setRole(value)
    setPage(1)
    setDetailId(null)
  }

  return {
    detailId,
    isFetching: readersQuery.isFetching,
    isLoading: readersQuery.isLoading,
    page,
    pagination: readersQuery.data?.pagination,
    readers: readersQuery.data?.data ?? [],
    refetch: () => void readersQuery.refetch(),
    role,
    search,
    setDetailId,
    setPage,
    setRole: changeRole,
    setSearch: changeSearch,
    setShowDetailOnMobile,
    showDetailOnMobile,
  }
}
