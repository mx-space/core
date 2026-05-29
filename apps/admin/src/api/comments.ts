import type { CommentModel, CommentsResponse } from '~/models/comment'

import { deleteJson, getJson, patchJson, postJson } from './http'

export interface GetCommentsParams {
  page: number
  size: number
  state: number
}

export interface ReplyCommentData {
  text: string
}

export function getComments(params: GetCommentsParams) {
  return getJson<CommentsResponse>('/comments', {
    page: params.page,
    size: params.size,
    state: params.state,
  })
}

export function replyComment(id: string, text: string) {
  return postJson<CommentModel, ReplyCommentData>(
    `/comments/reader/reply/${id}`,
    { text },
  )
}

export function updateCommentState(id: string, state: number) {
  return patchJson<CommentModel, { state: number }>(`/comments/${id}`, {
    state,
  })
}

export function batchUpdateCommentState(
  options:
    | { currentState: number; all: true; state: number }
    | { ids: string[]; state: number },
) {
  return patchJson<void, typeof options>('/comments/batch/state', options)
}

export function deleteComment(id: string) {
  return deleteJson<void>(`/comments/${id}`)
}

export function batchDeleteComments(
  options: { all: true; state: number } | { ids: string[] },
) {
  return deleteJson<void, typeof options>('/comments/batch', options)
}
