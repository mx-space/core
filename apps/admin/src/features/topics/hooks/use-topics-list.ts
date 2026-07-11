import { useMemo } from 'react'

import { getTopics } from '~/api/topics'
import { useCollectionListQuery, useEntityList } from '~/data/resource/hooks'
import { topics } from '~/data/resources/topic'
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

  const listKey = adminQueryKeys.topics.list({
    page: state.page,
    size: topicPageSize,
  })

  const topicsQuery = useCollectionListQuery(topics, {
    queryFn: () => getTopics({ page: state.page, size: topicPageSize }),
    queryKey: listKey,
    toPage: (result) => ({
      items: result.data,
      pagination: result.pagination,
    }),
  })
  const topicsList = useEntityList(topics, listKey, { keepPrevious: true })

  return {
    page: state.page,
    pagination: topicsList.pagination,
    setPage: (page: number) => setState({ page }),
    topics: topicsList.items,
    topicsQuery,
  }
}
