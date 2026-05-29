import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router'

import { findInListCache } from '~/api/list-cache'
import { getTopic } from '~/api/topics'
import type { TopicModel } from '~/models/topic'
import { adminQueryKeys } from '~/query/keys'

import { TopicDetail } from './TopicDetail'
import { TopicDetailEmpty } from './TopicDetailEmpty'
import { useTopicsRouteContext } from './topics-route-context'

const LIST_PREFIX = adminQueryKeys.topics.listRoot

export function TopicDetailRoute() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const ctx = useTopicsRouteContext()

  const initialTopic = id
    ? findInListCache<TopicModel>(queryClient, LIST_PREFIX, id)
    : undefined

  // Prime the detail cache so the inner TopicDetail useQuery resolves
  // synchronously on mount.
  useQuery({
    enabled: Boolean(id),
    initialData: initialTopic,
    queryFn: () => getTopic(id!),
    queryKey: id
      ? adminQueryKeys.topics.detail(id)
      : adminQueryKeys.topics.root,
    staleTime: initialTopic ? 30_000 : 0,
  })

  if (!id) return <TopicDetailEmpty />

  return (
    <TopicDetail
      deleting={ctx.deleting}
      key={id}
      onBack={ctx.onBack}
      onDelete={ctx.onDelete}
      onEdit={ctx.onEdit}
      topicId={id}
    />
  )
}

export default TopicDetailRoute
