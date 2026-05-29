import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { getLinks, getLinkStateCount } from '~/api/links'
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

  const linksQuery = useQuery({
    placeholderData: (previous) => previous,
    queryFn: () =>
      getLinks({
        page: state.page,
        size: friendsPageSize,
        state: state.state,
      }),
    queryKey: adminQueryKeys.links.list({
      page: state.page,
      size: friendsPageSize,
      state: state.state,
    }),
  })

  const countsQuery = useQuery({
    queryFn: getLinkStateCount,
    queryKey: adminQueryKeys.links.stateCount(),
  })

  return {
    counts: countsQuery.data,
    countsQuery,
    links: linksQuery.data?.data ?? [],
    linksQuery,
    page: state.page,
    pagination: linksQuery.data?.pagination,
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
