import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router'

import { getOwner } from '~/api/options'
import type { ReaderModel } from '~/api/readers'
import { adminQueryKeys } from '~/query/keys'
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
    queryKey: adminQueryKeys.shell.owner(),
    retry: false,
  })
  const currentUserId = ownerQuery.data?.id ?? null

  const buildListPath = useCallback(() => {
    return `/readers${list.listQueryString ? `?${list.listQueryString}` : ''}`
  }, [list.listQueryString])

  const handleSelect = useCallback(
    (reader: ReaderModel) => {
      navigate(
        `/readers/${reader.id}${list.listQueryString ? `?${list.listQueryString}` : ''}`,
      )
    },
    [list.listQueryString, navigate],
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
            membershipStatus={list.membershipStatus}
            onMembershipStatusChange={list.setMembershipStatus}
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
