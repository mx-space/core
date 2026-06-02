import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router'

import { getCommentThread } from '~/api/comments'
import { findInListCache } from '~/api/list-cache'
import { useDocumentTitle } from '~/hooks/use-document-title'
import type { CommentModel } from '~/models/comment'
import { adminQueryKeys } from '~/query/keys'

import { useAuthorActivity } from '../hooks/use-author-activity'
import { CommentDetail } from './CommentDetail'
import { CommentDetailEmpty } from './CommentDetailEmpty'
import { useCommentsRouteContext } from './comments-route-context'

export function CommentDetailRoute() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const ctx = useCommentsRouteContext()

  const comment = id
    ? findInListCache<CommentModel>(queryClient, LIST_PREFIX, id)
    : undefined
  const threadQuery = useQuery({
    enabled: !!id,
    queryFn: () => getCommentThread(id!),
    queryKey: id ? adminQueryKeys.comments.thread(id) : [],
  })
  const current = threadQuery.data?.current ?? comment

  const activityQuery = useAuthorActivity({
    ip: current?.ip,
    mail: current?.mail,
  })

  useDocumentTitle(current?.author)

  if (!id || !current) return <CommentDetailEmpty />

  return (
    <CommentDetail
      activity={activityQuery.activity}
      activityLoading={activityQuery.isLoading}
      comment={current}
      onBack={ctx.onBack}
      onDelete={(targetId) => {
        const target =
          threadQuery.data?.thread.find((item) => item.id === targetId) ??
          (current.id === targetId ? current : null)
        if (target) ctx.onDelete(target)
      }}
      onReply={ctx.onReply}
      onStateChange={ctx.onStateChange}
      replyPending={ctx.replyPending}
      thread={threadQuery.data}
      threadLoading={threadQuery.isLoading}
    />
  )
}

export default CommentDetailRoute

const LIST_PREFIX = adminQueryKeys.comments.listRoot
