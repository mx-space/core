import { useMemo } from 'react'

import { getSays } from '~/api/says'
import { useCollectionListQuery, useEntityList } from '~/data/resource/hooks'
import { says } from '~/data/resources/say'
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

  const listKey = adminQueryKeys.says.list({
    page: state.page,
    size: saysPageSize,
  })

  const saysQuery = useCollectionListQuery(says, {
    queryFn: () => getSays({ page: state.page, size: saysPageSize }),
    queryKey: listKey,
    toPage: (result) => ({
      items: result.data,
      pagination: result.pagination,
    }),
  })
  const saysList = useEntityList(says, listKey, { keepPrevious: true })

  return {
    page: state.page,
    pagination: saysList.pagination,
    says: saysList.items,
    saysQuery,
    setPage: (page: number) => setState({ page }),
  }
}
