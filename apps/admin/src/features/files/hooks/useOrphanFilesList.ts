import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { getOrphanFiles } from '~/api/files'
import { useUrlListState } from '~/features/_shared/hooks/use-url-list-state'
import { adminQueryKeys } from '~/query/keys'

import { FILES_PAGE_SIZE } from '../constants'

interface OrphanFilesListState {
  page: number
}

export function useOrphanFilesList() {
  const urlStateOptions = useMemo(
    () => ({
      read: (searchParams: URLSearchParams): OrphanFilesListState => ({
        page: readPositivePage(searchParams.get('page')),
      }),
      write: (state: OrphanFilesListState) => {
        const nextParams = new URLSearchParams()
        if (state.page > 1) nextParams.set('page', String(state.page))
        return nextParams
      },
    }),
    [],
  )

  const [state, setState] = useUrlListState(urlStateOptions)

  const orphansQuery = useQuery({
    placeholderData: (previous) => previous,
    queryFn: () => getOrphanFiles(state.page, FILES_PAGE_SIZE),
    queryKey: adminQueryKeys.files.orphans({
      page: state.page,
      size: FILES_PAGE_SIZE,
    }),
  })

  return {
    orphans: orphansQuery.data?.data ?? [],
    orphansQuery,
    page: state.page,
    pageCount: orphansQuery.data?.pagination.totalPage ?? 1,
    setPage: (page: number) => setState({ page }),
    total: orphansQuery.data?.pagination.total ?? 0,
  }
}

function readPositivePage(value: null | string) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}
