import { useParams } from 'react-router'

import { getTopic } from '~/api/topics'
import { useCollectionDetailQuery, useEntity } from '~/data/resource/hooks'
import { topics } from '~/data/resources/topic'
import { useDocumentTitle } from '~/hooks/use-document-title'
import { adminQueryKeys } from '~/query/keys'

import { TopicDetail } from './TopicDetail'
import { TopicDetailEmpty } from './TopicDetailEmpty'
import { useTopicsRouteContext } from './topics-route-context'

export function TopicDetailRoute() {
  const { id } = useParams<{ id: string }>()
  const ctx = useTopicsRouteContext()

  const topic = useEntity(topics, id)

  useCollectionDetailQuery(topics, {
    enabled: Boolean(id),
    queryFn: () => getTopic(id!),
    queryKey: id
      ? adminQueryKeys.topics.detail(id)
      : adminQueryKeys.topics.root,
  })

  useDocumentTitle(topic?.name)

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
