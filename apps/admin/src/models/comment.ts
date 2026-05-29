import type { Pager } from './base'

export interface CommentParentPreview {
  id: string
  author: string | null
  text: string
  isDeleted: boolean
}

export interface CommentReplyWindow {
  total: number
  returned: number
  threshold: number
  hasHidden: boolean
  hiddenCount: number
  nextCursor?: string
}

export interface CommentModel {
  id: string
  createdAt: string
  refType: 'post' | 'note' | 'page' | 'recently'
  state: number
  author: string
  text: string
  mail?: string
  url?: string
  ip?: string
  agent?: string
  pin?: boolean
  avatar?: string
  isWhispers?: boolean
  parentCommentId?: string | null
  parent?: CommentParentPreview | null
  rootCommentId?: string | null
  replyCount?: number
  latestReplyAt?: string | null
  isDeleted?: boolean
  deletedAt?: string | null
  editedAt?: string | null
  anchor?: Record<string, unknown> | null
  replies?: CommentModel[]
  replyWindow?: CommentReplyWindow
  ref?: Record<string, any>
}

export interface CommentsResponse {
  data: CommentModel[]
  pagination: Pager
}

export enum CommentState {
  Unread,
  Read,
  Junk,
}
