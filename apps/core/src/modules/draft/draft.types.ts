import type { EntityId } from '~/shared/id/entity-id'

import type { DraftRefType } from './draft.enum'

export type { DraftRefType }

export type DraftBranchStatus = 'active' | 'archived'
export type RevisionRelation = 'same' | 'ancestor' | 'descendant' | 'diverged'

export interface RevisionSnapshot {
  content: string | null
  contentFormat: string
  images: unknown[] | null
  meta: Record<string, unknown> | null
  text: string
  title: string
  typeSpecificData: Record<string, unknown> | null
}

export interface ContentDocumentRow {
  createdAt: Date
  id: EntityId
  publishedRevisionId: EntityId | null
  refId: EntityId | null
  refType: DraftRefType
  updatedAt: Date | null
}

export interface ContentRevisionRow extends RevisionSnapshot {
  createdAt: Date
  documentId: EntityId
  id: EntityId
  parentRevisionId: EntityId | null
}

export interface ContentPublicationEventRow {
  createdAt: Date
  documentId: EntityId
  id: EntityId
  previousRevisionId: EntityId | null
  revisionId: EntityId
}

export interface DraftBranchRow {
  baseRevisionId: EntityId
  createdAt: Date
  documentId: EntityId
  headRevisionId: EntityId
  id: EntityId
  status: DraftBranchStatus
  updatedAt: Date | null
}

export interface RevisionComparison {
  commonAncestorRevisionId: EntityId | null
  left: ContentRevisionRow
  relation: RevisionRelation
  right: ContentRevisionRow
}

export interface DraftBranchView extends DraftBranchRow {
  baseRevision: ContentRevisionRow
  commonAncestorRevisionId: EntityId | null
  document: ContentDocumentRow
  headRevision: ContentRevisionRow
  publishedRevision: ContentRevisionRow | null
  relationToPublished: RevisionRelation | null
}

export interface VersionContext {
  branches: DraftBranchView[]
  document: ContentDocumentRow
  publishedRevision: ContentRevisionRow | null
  versionTree: VersionTreeNode[]
}

export interface VersionTreeNode {
  branchBaseIds: EntityId[]
  branchHeadIds: EntityId[]
  collapsedRevisionCount: number
  parentNodeId: EntityId | null
  publishedAt: Date | null
  revision: ContentRevisionRow
}

export interface CreateDraftBranchInput extends RevisionSnapshot {
  baseRevisionId?: EntityId | string | null
  refId?: EntityId | string | null
  refType: DraftRefType
}

export type SaveDraftBranchInput = RevisionSnapshot & {
  expectedHeadRevisionId: EntityId | string
}

export interface DraftListFilter {
  hasRef?: boolean
  refType?: DraftRefType
  search?: string
  status?: DraftBranchStatus
}
