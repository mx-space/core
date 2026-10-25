import type { EntityId } from '~/shared/id/entity-id'

import type { PublishAiResourceRequest } from '../publish/publish.types'
import type { DraftRefType } from './draft.enum'

export type { DraftRefType }

export type DraftBranchStatus = 'active' | 'archived'
export type DraftShareMode = 'pinned' | 'follow'
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
  crdtEpoch: number
  id: EntityId
  publishAiResources: PublishAiResourceRequest[] | null
  publishedRevisionId: EntityId | null
  refId: EntityId | null
  refType: DraftRefType
  updatedAt: Date | null
}

export type Frontiers = { counter: number; peer: `${number}` }[]

export type CheckpointKind =
  'save' | 'publish' | 'restore' | 'undo' | 'import' | 'legacy-save'

export interface ContentRevisionRow extends RevisionSnapshot {
  createdAt: Date
  documentId: EntityId
  frontiers?: Frontiers | null
  id: EntityId
  kind?: CheckpointKind | null
  parentRevisionId: EntityId | null
}

export interface CrdtFields {
  meta: Record<string, unknown> | null
  typeSpecificData: Record<string, unknown> | null
}

export type CrdtFieldsPatch = {
  [K in keyof CrdtFields]?: Record<string, unknown>
}

export interface CrdtDocRow {
  createdAt: Date
  documentId: EntityId
  fields: CrdtFields | null
  snapshot: Uint8Array
  snapshotVersion: Uint8Array
  syncedRevisionId: EntityId | null
  updatedAt: Date | null
}

export interface CheckpointInput {
  frontiers: Frontiers | null
  kind: CheckpointKind
  snapshot: RevisionSnapshot
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

export const DRAFT_RELATIONS = ['in_sync', 'ahead', 'fresh'] as const
export type DraftRelation = (typeof DRAFT_RELATIONS)[number]

export interface DraftCardFilter extends DraftListFilter {
  relation?: DraftRelation
  sort?: 'size' | 'updated'
}

export interface DraftCard {
  baseRevisionId: EntityId
  createdAt: Date
  document: {
    id: EntityId
    publishedRevisionId: EntityId | null
    refId: EntityId | null
    refType: DraftRefType
  }
  documentId: EntityId
  headRevision: {
    contentFormat: string
    createdAt: Date
    id: EntityId
    title: string
  }
  headRevisionId: EntityId
  id: EntityId
  relation: DraftRelation
  status: DraftBranchStatus
  storage: { crdtBytes: number; revisionBytes: number; revisionCount: number }
  updatedAt: Date | null
}

export interface DocumentShareRow {
  createdAt: Date
  documentId: EntityId
  draftId: EntityId | null
  id: EntityId
  mode: DraftShareMode
  revisionId: EntityId | null
  token: string
  updatedAt: Date | null
}

export interface SharedRevisionSnapshot {
  content: string | null
  contentFormat: string
  createdAt: Date
  images: unknown[] | null
  refType: DraftRefType
  text: string
  title: string
}

/**
 * Payload of the `draft.update` admin broadcast. Carries only identity and the
 * new head: the editor that receives it already has the content, and comparing
 * one revision id is enough to decide whether its view is stale. Clients must
 * not treat receipt as authoritative content — re-read the draft instead.
 */
export interface DraftUpdateEventPayload {
  branchId: EntityId
  documentId: EntityId
  headRevisionId: EntityId
  refId: EntityId | null
  refType: DraftRefType
}
