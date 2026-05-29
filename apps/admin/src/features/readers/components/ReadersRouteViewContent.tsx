import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router'

import { getOwner } from '~/api/options'
import type { ReaderModel } from '~/api/readers'
import { MasterDetailShell } from '~/ui/layout/master-detail-shell'

import { useReaderMutations } from '../hooks/useReaderMutations'
import { useReadersList } from '../hooks/useReadersList'
import { useReaderStats } from '../hooks/useReaderStats'
import { ReaderDetailEmpty } from './ReaderDetailEmpty'
import { ReadersRouteContext } from './readers-route-context'
import { ReadersListPanel } from './ReadersListPanel'

export function ReadersRouteViewContent() {
  const navigate = useNavigate()
  const params = useParams<{ id?: string }>()
  const detailId = params.id ?? null

  const list = useReadersList()
  const statsQuery = useReaderStats()
  const mutations = useReaderMutations()

  const ownerQuery = useQuery({
    queryFn: getOwner,
    queryKey: ['shell', 'owner'],
    retry: false,
  })
  const currentUserId = ownerQuery.data?.id ?? null

  const buildListPath = useCallback(() => {
    const sp = new URLSearchParams()
    if (list.role !== 'all') sp.set('role', list.role)
    if (list.search) sp.set('q', list.search)
    if (list.page > 1) sp.set('page', String(list.page))
    const qs = sp.toString()
    return `/readers${qs ? `?${qs}` : ''}`
  }, [list.page, list.role, list.search])

  const handleSelect = useCallback(
    (reader: ReaderModel) => {
      const sp = new URLSearchParams()
      if (list.role !== 'all') sp.set('role', list.role)
      if (list.search) sp.set('q', list.search)
      if (list.page > 1) sp.set('page', String(list.page))
      const qs = sp.toString()
      navigate(`/readers/${reader.id}${qs ? `?${qs}` : ''}`)
    },
    [list.page, list.role, list.search, navigate],
  )

  const closeDetail = useCallback(() => {
    navigate(buildListPath())
  }, [buildListPath, navigate])

  const ctxValue = useMemo(
    () => ({
      currentUserId,
      mutations,
      onBack: closeDetail,
    }),
    [currentUserId, mutations, closeDetail],
  )

  return (
    <ReadersRouteContext.Provider value={ctxValue}>
      <MasterDetailShell
        defaultSize={340}
        emptyDetail={<ReaderDetailEmpty />}
        maxSize={520}
        minSize={280}
        list={
          <ReadersListPanel
            detailId={detailId}
            isFetching={list.isFetching}
            isLoading={list.isLoading}
            onPageChange={list.setPage}
            onRefresh={list.refetch}
            onRoleChange={list.setRole}
            onSearchChange={list.setSearch}
            onSelect={handleSelect}
            page={list.page}
            pagination={list.pagination}
            readers={list.readers}
            role={list.role}
            search={list.search}
            stats={statsQuery.data}
          />
        }
      />
    </ReadersRouteContext.Provider>
  )
}
