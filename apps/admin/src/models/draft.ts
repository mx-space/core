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

export interface ContentRevision extends RevisionSnapshot {
  createdAt: string
  documentId: string
  id: string
  parentRevisionId: string | null
}

export interface ContentDocument {
  createdAt: string
  id: string
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
