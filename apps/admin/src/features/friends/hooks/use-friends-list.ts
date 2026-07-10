import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { getLinks, getLinkStateCount } from '~/api/links'
import { useCollectionListQuery, useEntityList } from '~/data/resource/hooks'
import { links } from '~/data/resources/link'
import { useUrlListState } from '~/features/_shared/hooks/use-url-list-state'
import type { LinkState } from '~/models/link'
import { adminQueryKeys } from '~/query/keys'

import { friendsPageSize } from '../constants'
import { normalizeState, readPage } from '../utils/friends'

interface FriendsListState {
  page: number
  state: LinkState
}

export function useFriendsList() {
  const urlStateOptions = useMemo(
    () => ({
      read: (searchParams: URLSearchParams): FriendsListState => ({
        page: readPage(searchParams.get('page')),
        state: normalizeState(searchParams.get('state')),
      }),
      write: (state: FriendsListState) => {
        const nextParams = new URLSearchParams()
        nextParams.set('state', String(state.state))
        if (state.page > 1) nextParams.set('page', String(state.page))
        return nextParams
      },
    }),
    [],
  )

  const [state, setState] = useUrlListState(urlStateOptions)

  const linksListKey = adminQueryKeys.links.list({
    page: state.page,
    size: friendsPageSize,
    state: state.state,
  })

  const linksQuery = useCollectionListQuery(links, {
    queryFn: () =>
      getLinks({
        page: state.page,
        size: friendsPageSize,
        state: state.state,
      }),
    queryKey: linksListKey,
    toPage: (result) => ({
      items: result.data,
      pagination: result.pagination,
    }),
  })

  const linksList = useEntityList(links, linksListKey, { keepPrevious: true })

  const countsQuery = useQuery({
    queryFn: getLinkStateCount,
    queryKey: adminQueryKeys.links.stateCount(),
  })

  return {
    counts: countsQuery.data,
    countsQuery,
    links: linksList.items,
    linksQuery,
    page: state.page,
    pagination: linksList.pagination,
    setPage: (page: number | ((current: number) => number)) => {
      setState((current) => ({
        ...current,
        page: typeof page === 'function' ? page(current.page) : page,
      }))
    },
    setState: (nextState: LinkState) =>
      setState((current) => ({ ...current, page: 1, state: nextState })),
    state: state.state,
  }
}
