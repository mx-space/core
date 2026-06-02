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
  countryCode?: string
}

export interface CommentsResponse {
  data: CommentModel[]
  pagination: Pager
}

export interface CommentSourceCandidate {
  id: string
  type: CommentModel['refType']
  title?: string
  slug?: string | null
  nid?: number
  category?: { name: string; slug: string } | null
  commentCount: number
  latestCommentAt: string
}

export interface CommentThreadResponse {
  currentCommentId: string
  rootCommentId: string
  root: CommentModel | null
  thread: CommentModel[]
  current: CommentModel
  ref: CommentSourceCandidate | null
}

export enum CommentState {
  Unread,
  Read,
  Junk,
}

export type CommentTab =
  | 'unread'
  | 'awaiting'
  | 'whispers'
  | 'read'
  | 'junk'
  | 'all'

export interface CommentTabCounts {
  unread: number
  read: number
  junk: number
  whispers: number
  awaiting: number
  all: number
}

export interface CommentAuthorActivityItem {
  id: string
  createdAt: string
  refType: CommentModel['refType']
  refTitle?: string
  refLink?: string
  textExcerpt: string
  state: number
}

export type CommentThreatLevel = 'trusted' | 'neutral' | 'risk'

export interface CommentAuthorActivity {
  totalCount: number
  firstSeenAt: string
  lastSeenAt: string
  items: CommentAuthorActivityItem[]
  threatLevel: CommentThreatLevel
  threatReason?: string
}
