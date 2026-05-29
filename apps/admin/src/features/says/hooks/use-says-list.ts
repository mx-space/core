import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { getSays } from '~/api/says'
import { useUrlListState } from '~/features/_shared/hooks/use-url-list-state'
import { adminQueryKeys } from '~/query/keys'

import { saysPageSize } from '../constants'
import { readSaysPage } from '../utils/format'

interface SaysListState {
  page: number
}

export function useSaysList() {
  const urlStateOptions = useMemo(
    () => ({
      read: (searchParams: URLSearchParams): SaysListState => ({
        page: readSaysPage(searchParams.get('page')),
      }),
      write: (state: SaysListState) => {
        const nextParams = new URLSearchParams()
        if (state.page > 1) nextParams.set('page', String(state.page))
        return nextParams
      },
    }),
    [],
  )

  const [state, setState] = useUrlListState(urlStateOptions)

  const saysQuery = useQuery({
    placeholderData: (previous) => previous,
    queryFn: () => getSays({ page: state.page, size: saysPageSize }),
    queryKey: adminQueryKeys.says.list({
      page: state.page,
      size: saysPageSize,
    }),
  })

  return {
    page: state.page,
    pagination: saysQuery.data?.pagination,
    says: saysQuery.data?.data ?? [],
    saysQuery,
    setPage: (page: number) => setState({ page }),
  }
}
