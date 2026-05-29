import { useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router'

import { findInListCache } from '~/api/list-cache'
import type { CommentModel } from '~/models/comment'
import { adminQueryKeys } from '~/query/keys'

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

  if (!id || !comment) return <CommentDetailEmpty />

  return (
    <CommentDetail
      comment={comment}
      currentState={ctx.currentState}
      onBack={ctx.onBack}
      onDelete={(targetId) => {
        const target = comment.id === targetId ? comment : null
        if (target) ctx.onDelete(target)
      }}
      onReply={ctx.onReply}
      onStateChange={ctx.onStateChange}
      replyPending={ctx.replyPending}
    />
  )
}

export default CommentDetailRoute

const LIST_PREFIX = adminQueryKeys.comments.listRoot
