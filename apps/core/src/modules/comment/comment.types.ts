import type { CollectionRefTypes } from '~/constants/db.constant'
import type { EntityId } from '~/shared/id/entity-id'

import type { CommentAnchorMode } from './comment.enum'

export type CommentRefType = `${CollectionRefTypes}`

export interface CommentRow {
  id: EntityId
  refType: CommentRefType
  refId: EntityId
  author: string | null
  mail: string | null
  url: string | null
  text: string
  state: number
  parentCommentId: EntityId | null
  rootCommentId: EntityId | null
  replyCount: number
  latestReplyAt: Date | null
  isDeleted: boolean
  deletedAt: Date | null
  pin: boolean
  isWhispers: boolean
  avatar: string | null
  authProvider: string | null
  meta: string | null
  readerId: string | null
  editedAt: Date | null
  anchor: Record<string, unknown> | null
  ip: string | null
  agent: string | null
  location: string | null
  isOwnerReply: boolean
  countryCode: string | null
  createdAt: Date
}

/**
 * Repository-level extension returned by `findByIdWithRelations`. Joined data
 * lives outside the persistence row so service- and controller-layers can
 * project to a slimmer shape (e.g. `parent` becomes `CommentParentPreview`)
 * without conflicting with the base row type.
 */
export interface CommentRowWithRelations extends CommentRow {
  parent: CommentRow | null
  children: CommentRow[]
}

export interface CommentCreateInput {
  refType: CommentRefType
  refId: EntityId | string
  text: string
  author?: string | null
  mail?: string | null
  url?: string | null
  state?: number
  parentCommentId?: EntityId | string | null
  rootCommentId?: EntityId | string | null
  pin?: boolean
  isWhispers?: boolean
  avatar?: string | null
  authProvider?: string | null
  meta?: string | null
  readerId?: string | null
  anchor?: Record<string, unknown> | null
  ip?: string | null
  agent?: string | null
  location?: string | null
  isOwnerReply?: boolean
  countryCode?: string | null
}

export interface CommentFindFilter {
  state?: number
  refType?: CommentRefType
  refId?: EntityId | string
  search?: string
  tab?: CommentTab
  author?: string
}

/**
 * Inbox tabs surfaced by `/comments` admin route. `state` (numeric) is the
 * deprecated parameter; `tab` semantics supersede it (spec §6.1).
 */
export type CommentTab =
  | 'unread'
  | 'read'
  | 'junk'
  | 'whispers'
  | 'awaiting'
  | 'all'

export interface CommentTabCounts {
  unread: number
  read: number
  junk: number
  whispers: number
  awaiting: number
  all: number
}

export interface CommentTabCountsFilter {
  refType?: CommentRefType
  refId?: EntityId | string
}

export type AuthorThreatLevel = 'trusted' | 'neutral' | 'risk'

export interface AuthorActivityItem {
  id: EntityId
  createdAt: Date
  refType: CommentRefType
  refId: EntityId
  textExcerpt: string
  state: number
  isDeleted: boolean
}

export interface AuthorActivity {
  totalCount: number
  firstSeenAt: Date | null
  lastSeenAt: Date | null
  items: AuthorActivityItem[]
  threatLevel: AuthorThreatLevel
  threatReason?: string
}

export interface AuthorActivityFilter {
  mail?: string
  ip?: string
  limit?: number
}

export interface CommentSourceCandidate {
  refType: CommentRefType
  refId: EntityId
  count: number
  latestCommentAt: Date
}

export type CommentRootSort = 'pinned' | 'newest' | 'oldest'

export interface CommentPublicFilterOptions {
  isAuthenticated: boolean
  commentShouldAudit: boolean
  hasAnchor?: boolean
}

export interface CommentRootListOptions extends CommentPublicFilterOptions {
  page: number
  size: number
  sort: CommentRootSort
  around?: EntityId | string
}

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

export type CommentModel = CommentRow
