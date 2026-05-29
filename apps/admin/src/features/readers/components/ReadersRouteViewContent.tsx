import { useQuery } from '@tanstack/react-query'
import type { ReaderModel } from '~/api/readers'

import { getOwner } from '~/api/options'
import { MasterDetailLayout } from '~/ui/layout/page-layout'

import { useReaderDetail } from '../hooks/useReaderDetail'
import { useReaderMutations } from '../hooks/useReaderMutations'
import { useReadersList } from '../hooks/useReadersList'
import { useReaderStats } from '../hooks/useReaderStats'
import { ReaderDetailEmpty } from './ReaderDetailEmpty'
import { ReadersDetailPane } from './ReadersDetailPane'
import { ReadersListPanel } from './ReadersListPanel'

export function ReadersRouteViewContent() {
  const list = useReadersList()
  const statsQuery = useReaderStats()
  const mutations = useReaderMutations()
  const { isLoading: detailLoading, reader: selectedReader } = useReaderDetail(
    list.detailId,
    list.readers,
  )

  const ownerQuery = useQuery({
    queryFn: getOwner,
    queryKey: ['shell', 'owner'],
    retry: false,
  })
  const currentUserId = ownerQuery.data?.id ?? null

  const handleSelect = (reader: ReaderModel) => {
    list.setDetailId(reader.id)
    list.setShowDetailOnMobile(true)
  }

  return (
    <MasterDetailLayout
      defaultSize={340}
      maxSize={520}
      minSize={280}
      list={
        <ReadersListPanel
          detailId={list.detailId}
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
      showDetailOnMobile={list.showDetailOnMobile}
      detail={
        selectedReader ? (
          <ReadersDetailPane
            currentUserId={currentUserId}
            isLoading={detailLoading}
            mutations={mutations}
            onBack={() => list.setShowDetailOnMobile(false)}
            reader={selectedReader}
          />
        ) : (
          <ReaderDetailEmpty />
        )
      }
    />
  )
}
