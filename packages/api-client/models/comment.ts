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

/**
 * 评论锚之模式：block 锚至单 block，range 锚至 block 内字符 range。
 * 与服务端 `apps/core/src/modules/comment/comment.enum.ts` 同步。
 */
export enum CommentAnchorMode {
  Block = 'block',
  Range = 'range',
}

/**
 * 评论锚定到内容块的元数据。两种 mode 共用一组字段，按 mode 不同取
 * 不同子集；range 模式下 `startOffset`/`endOffset` 必填，block 模式下
 * 二者皆可省。
 */
export interface CommentAnchorModel {
  mode: CommentAnchorMode
  blockId: string
  blockType?: string
  blockFingerprint?: string
  snapshotText?: string
  quote?: string
  prefix?: string
  suffix?: string
  startOffset?: number
  endOffset?: number
  contentHashAtCreate?: string
  contentHashCurrent?: string
  lastResolvedAt?: string
  lang?: string | null
}

/**
 * 评论 ref 摘要：list/admin 端点之 attachRef 注入。orphan ref（目标已删）
 * 时为 null。Mirrors server's `CommentRefSummary`.
 */
export interface CommentRefSummary {
  id: string
  type: CollectionRefTypes
  title?: string
  slug?: string | null
  nid?: number
  category?: { name: string; slug: string } | null
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
  anchor: CommentAnchorModel | null

  /** 仅 list/detail 端点附加（服务端 attachParentPreview 之结果）。 */
  parent?: CommentParentPreview | null

  /** admin/list 端点附加（服务端 attachRef 之结果）；orphan 时为 null。 */
  ref?: CommentRefSummary | null
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
