import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { getTopics } from '~/api/topics'
import { useUrlListState } from '~/features/_shared/hooks/use-url-list-state'
import { adminQueryKeys } from '~/query/keys'

import { topicPageSize } from '../constants'
import { readPositiveInt } from '../utils/search-params'

interface TopicsListState {
  page: number
}

export function useTopicsList() {
  const urlStateOptions = useMemo(
    () => ({
      read: (searchParams: URLSearchParams): TopicsListState => ({
        page: readPositiveInt(searchParams.get('page')),
      }),
      write: (state: TopicsListState) => {
        const nextParams = new URLSearchParams()
        if (state.page > 1) nextParams.set('page', String(state.page))
        return nextParams
      },
    }),
    [],
  )

  const [state, setState] = useUrlListState(urlStateOptions)

  const topicsQuery = useQuery({
    placeholderData: (previous) => previous,
    queryFn: () => getTopics({ page: state.page, size: topicPageSize }),
    queryKey: adminQueryKeys.topics.list({
      page: state.page,
      size: topicPageSize,
    }),
  })

  return {
    page: state.page,
    pagination: topicsQuery.data?.pagination,
    setPage: (page: number) => setState({ page }),
    topics: topicsQuery.data?.data ?? [],
    topicsQuery,
  }
}
