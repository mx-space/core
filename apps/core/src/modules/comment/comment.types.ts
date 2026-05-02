import type { CollectionRefTypes } from '~/constants/db.constant'
import type { BaseModel } from '~/shared/types/legacy-model.type'

import type { CommentAnchorMode, CommentState } from './comment.enum'

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
  lastResolvedAt?: Date
  lang?: string | null
}

export interface CommentModel extends BaseModel {
  ref?: any
  refType: CollectionRefTypes
  author?: string
  mail?: string
  url?: string
  text: string
  state?: CommentState
  parentCommentId?: any
  rootCommentId?: any
  replyCount?: number
  latestReplyAt?: Date
  isDeleted?: boolean
  deletedAt?: Date
  ip?: string
  agent?: string
  pin?: boolean
  post?: any
  note?: any
  page?: any
  recently?: any
  location?: string
  isWhispers?: boolean
  avatar?: string
  authProvider?: string
  meta?: string
  readerId?: string
  editedAt?: Date
  anchor?: CommentAnchorModel
}
