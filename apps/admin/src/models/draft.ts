import type { PublishAiResourceRequest } from '~/api/publish-jobs'

import type { Image, Pager } from './base'

export enum DraftRefType {
  Post = 'post',
  Note = 'note',
  Page = 'page',
}

export type RevisionRelation = 'same' | 'ancestor' | 'descendant' | 'diverged'

export interface RevisionSnapshot {
  content: string | null
  contentFormat: 'lexical' | 'markdown'
  images: Image[] | null
  meta: Record<string, unknown> | null
  text: string
  title: string
  typeSpecificData: TypeSpecificData | null
}

export interface CrdtOpId {
  counter: number
  peer: `${number}`
}

export type CheckpointKind =
  'import' | 'legacy-save' | 'publish' | 'restore' | 'save' | 'undo'

export interface ContentRevision extends RevisionSnapshot {
  createdAt: string
  documentId: string
  frontiers?: CrdtOpId[] | null
  id: string
  kind?: CheckpointKind | null
  parentRevisionId: string | null
}

export type DraftCheckpoint = Pick<
  ContentRevision,
  | 'contentFormat'
  | 'createdAt'
  | 'frontiers'
  | 'id'
  | 'kind'
  | 'parentRevisionId'
  | 'title'
>

export interface DraftChange {
  deps: CrdtOpId[]
  id: CrdtOpId
  lamport: number
  message?: string
  timestamp: number
}

export interface DraftHistory {
  changes: DraftChange[]
  checkpoints: DraftCheckpoint[]
}

export interface DraftFields {
  meta: Record<string, unknown> | null
  typeSpecificData: Record<string, unknown> | null
}

export interface ContentDocument {
  createdAt: string
  id: string
  publishAiResources?: PublishAiResourceRequest[] | null
  publishedRevisionId: string | null
  refId: string | null
  refType: DraftRefType
  updatedAt: string | null
}

export interface DraftModel {
  baseRevision: ContentRevision
  baseRevisionId: string
  commonAncestorRevisionId: string | null
  createdAt: string
  document: ContentDocument
  documentId: string
  headRevision: ContentRevision
  headRevisionId: string
  id: string
  publishedRevision: ContentRevision | null
  relationToPublished: RevisionRelation | null
  status: 'active' | 'archived'
  updatedAt: string | null
}

export type DraftRelation = 'ahead' | 'fresh' | 'in_sync'

export interface DraftCard {
  baseRevisionId: string
  createdAt: string
  document: Pick<
    ContentDocument,
    'id' | 'publishedRevisionId' | 'refId' | 'refType'
  >
  documentId: string
  headRevision: Pick<
    ContentRevision,
    'contentFormat' | 'createdAt' | 'id' | 'title'
  >
  headRevisionId: string
  id: string
  relation: DraftRelation
  status: 'active' | 'archived'
  storage: { crdtBytes: number; revisionBytes: number; revisionCount: number }
  updatedAt: string | null
}

export interface DraftStorageSummary {
  crdt: { bytes: number; count: number }
  reclaimableBytes: number
  relations: { ahead: number; fresh: number; inSync: number }
  revisions: { bytes: number; count: number }
  updates: { bytes: number; count: number }
}

export type CleanupCategory = 'A' | 'B' | 'C' | 'D'

export interface CleanupDraftCandidate {
  bytes: number
  documentId: string
  draftId: string
  title: string
}

export interface CleanupPreview {
  archived: CleanupDraftCandidate[]
  categories: Record<CleanupCategory, { bytes: number; count: number }>
  inSync: CleanupDraftCandidate[]
  olderThanDays: number
}

export interface FreedTotals {
  bytes: number
  crdtDocs: number
  drafts: number
  revisions: number
}

export interface CleanupResult {
  freed: FreedTotals
  skipped: string[]
}

export interface CompactPreview {
  crdtBytes: number
  revisionBytes: number
  revisionIds: string[]
}

export type DraftShareMode = 'follow' | 'pinned'

export interface DraftShare {
  createdAt: string
  documentId: string
  draftId: string | null
  id: string
  mode: DraftShareMode
  revisionId: string | null
  token: string
  updatedAt: string | null
}

export interface VersionContext {
  branches: DraftModel[]
  document: ContentDocument
  publishedRevision: ContentRevision | null
  versionTree: VersionTreeNode[]
}

export interface VersionTreeNode {
  branchBaseIds: string[]
  branchHeadIds: string[]
  collapsedRevisionCount: number
  parentNodeId: string | null
  publishedAt: string | null
  revision: ContentRevision
}

export interface RevisionComparison {
  commonAncestorRevisionId: string | null
  left: ContentRevision
  relation: RevisionRelation
  right: ContentRevision
}

export interface DraftResponse {
  data: DraftModel[]
  pagination: Pager
}

export interface PostSpecificData {
  categoryId?: string
  copyright?: boolean
  isPremium?: boolean
  pin?: boolean | string | null
  pinOrder?: number
  relatedId?: string[]
  slug?: string
  summary?: string | null
  tags?: string[]
}

export interface NoteSpecificData {
  bookmark?: boolean
  coordinates?: {
    latitude: number
    longitude: number
  } | null
  location?: string
  mood?: string
  password?: string | null
  publicAt?: string | null
  slug?: string
  topicId?: string | null
  weather?: string
}

export interface PageSpecificData {
  order?: number
  slug?: string
  subtitle?: string | null
}

export type TypeSpecificData = PostSpecificData &
  NoteSpecificData &
  PageSpecificData
