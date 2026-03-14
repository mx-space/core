import { CollectionRefTypes } from '@core/constants/db.constant'

import type { BaseModel } from './base'
import type { CategoryModel } from './category'

export { CollectionRefTypes }
export interface CommentModel extends BaseModel {
  refType: CollectionRefTypes
  ref: string
  state: number
  author: string
  text: string
  mail?: string
  url?: string
  ip?: string
  agent?: string
  pin?: boolean

  avatar: string

  parentCommentId?: string | null
  rootCommentId?: string | null
  replyCount?: number
  latestReplyAt?: string | null
  isDeleted?: boolean
  deletedAt?: string

  isWhispers?: boolean
  location?: string

  readerId?: string
  editedAt?: string
}

export interface CommentReplyWindow {
  total: number
  returned: number
  threshold: number
  hasHidden: boolean
  hiddenCount: number
  nextCursor?: string
}

export interface CommentThreadItem extends CommentModel {
  replies: CommentModel[]
  replyWindow: CommentReplyWindow
}

export interface CommentThreadReplies {
  replies: CommentModel[]
  nextCursor?: string
  remaining: number
  done: boolean
}

export interface CommentRef {
  id: string
  categoryId?: string
  slug: string
  title: string
  category?: CategoryModel
}

export enum CommentState {
  Unread,
  Read,
  Junk,
}
