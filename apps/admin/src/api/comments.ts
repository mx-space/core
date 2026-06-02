import type {
  CommentAuthorActivity,
  CommentModel,
  CommentSourceCandidate,
  CommentsResponse,
  CommentTab,
  CommentTabCounts,
  CommentThreadResponse,
} from '~/models/comment'

import { deleteJson, getJson, patchJson, postJson } from './http'

export type CommentListState = 'all' | 0 | 1 | 2
export type CommentRefType = CommentModel['refType']

export interface GetCommentsParams {
  page: number
  refId?: string
  refType?: CommentRefType
  search?: string
  size: number
  state: CommentListState
  tab?: CommentTab
  author?: string
}

export interface ReplyCommentData {
  text: string
}

export function getComments(params: GetCommentsParams) {
  return getJson<CommentsResponse>('/comments', {
    author: params.author,
    page: params.page,
    refId: params.refId,
    refType: params.refType,
    search: params.search,
    size: params.size,
    // `tab` is the new canonical filter; keep `state` for one release of overlap
    // so an older server still receives a usable query.
    state: params.tab ? undefined : params.state,
    tab: params.tab,
  })
}

export interface GetCommentTabCountsParams {
  refId?: string
  refType?: CommentRefType
}

export function getCommentTabCounts(params: GetCommentTabCountsParams = {}) {
  return getJson<CommentTabCounts>('/comments/tab-counts', {
    refId: params.refId,
    refType: params.refType,
  })
}

export interface GetAuthorActivityParams {
  mail?: string
  ip?: string
  limit?: number
}

export function getAuthorActivity(params: GetAuthorActivityParams) {
  return getJson<CommentAuthorActivity>('/comments/author-activity', {
    ip: params.ip,
    limit: params.limit,
    mail: params.mail,
  })
}

export function getCommentSourceCandidates(params: {
  refType?: CommentRefType
  search?: string
  size?: number
}) {
  return getJson<{ data: CommentSourceCandidate[] }>(
    '/comments/source-candidates',
    params,
  )
}

export function getCommentThread(id: string) {
  return getJson<CommentThreadResponse>(`/comments/${id}/thread`)
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
    | {
        all: true
        currentState?: number
        refId?: string
        refType?: CommentRefType
        search?: string
        state: number
      }
    | { ids: string[]; state: number },
) {
  return patchJson<void, typeof options>('/comments/batch/state', options)
}

export function deleteComment(id: string) {
  return deleteJson<void>(`/comments/${id}`)
}

export function batchDeleteComments(
  options:
    | {
        all: true
        refId?: string
        refType?: CommentRefType
        search?: string
        state?: number
      }
    | { ids: string[] },
) {
  return deleteJson<void, typeof options>('/comments/batch', options)
}
