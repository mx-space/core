import { CollectionRefTypes } from '@core/constants/db.constant'

import type { CategoryModel } from './category'

export { CollectionRefTypes }

/**
 * 评论父级预览：仅暴露列表/详情中渲染父评论引用所需之最小字段。
 * 服务端有意去 ip/mail/agent 等 PII，故不可与 CommentModel 通用。
 */
export interface CommentParentPreview {
  id: string
  author: string | null
  text: string
  isDeleted: boolean
}

export interface CommentModel {
  id: string
  createdAt: string
  refType: CollectionRefTypes
  refId: string
  state: number
  author: string | null
  text: string
  mail: string | null
  url: string | null
  ip: string | null
  agent: string | null
  pin: boolean

  avatar: string | null

  parentCommentId: string | null
  rootCommentId: string | null
  replyCount: number
  latestReplyAt: string | null
  isDeleted: boolean
  deletedAt: string | null

  isWhispers: boolean
  location: string | null

  authProvider: string | null
  readerId: string | null
  editedAt: string | null
  anchor: Record<string, unknown> | null

  /** 仅 list/detail 端点附加（服务端 attachParentPreview 之结果）。 */
  parent?: CommentParentPreview | null
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
