import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { getRemoteFiles } from '~/api/files'
import { useUrlListState } from '~/features/_shared/hooks/use-url-list-state'
import { adminQueryKeys } from '~/query/keys'

import { FILES_PAGE_SIZE } from '../constants'

interface RemoteFilesListState {
  page: number
}

export function useRemoteFilesList() {
  const urlStateOptions = useMemo(
    () => ({
      read: (searchParams: URLSearchParams): RemoteFilesListState => ({
        page: readPositivePage(searchParams.get('page')),
      }),
      write: (state: RemoteFilesListState) => {
        const nextParams = new URLSearchParams()
        if (state.page > 1) nextParams.set('page', String(state.page))
        return nextParams
      },
    }),
    [],
  )

  const [state, setState] = useUrlListState(urlStateOptions)

  const remoteQuery = useQuery({
    placeholderData: (previous) => previous,
    queryFn: () => getRemoteFiles(state.page, FILES_PAGE_SIZE),
    queryKey: adminQueryKeys.files.remote({
      page: state.page,
      size: FILES_PAGE_SIZE,
    }),
  })

  return {
    files: remoteQuery.data?.data ?? [],
    page: state.page,
    pageCount: remoteQuery.data?.pagination.totalPage ?? 1,
    remoteQuery,
    setPage: (page: number) => setState({ page }),
    total: remoteQuery.data?.pagination.total ?? 0,
  }
}

function readPositivePage(value: null | string) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}
