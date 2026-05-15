import type { CollectionRefTypes } from '~/constants/db.constant'
import type { EntityId } from '~/shared/id/entity-id'

import type { EnrichmentResult } from '../enrichment/enrichment.types'

export type RecentlyRefType = `${CollectionRefTypes}` | null

export interface RecentlyRow {
  id: EntityId
  content: string
  type: string
  metadata: Record<string, unknown> | null
  refType: RecentlyRefType
  refId: EntityId | null
  commentsIndex: number
  allowComment: boolean
  up: number
  down: number
  createdAt: Date
  modifiedAt: Date | null
}

export interface RecentlyCreateInput {
  content?: string
  type: string
  metadata?: Record<string, unknown> | null
  refType?: RecentlyRefType
  refId?: EntityId | string | null
  allowComment?: boolean
}

export type RecentlyPatchInput = Partial<RecentlyCreateInput> & {
  modifiedAt?: Date | null
  up?: number
  down?: number
  commentsIndex?: number
}

export type RefType = {
  type: 'post' | 'note' | 'page'
  id: string
}

export type RecentlyModel = RecentlyRow

export type RecentlyWithEnrichment = RecentlyRow & {
  enrichments?: Record<string, EnrichmentResult>
  ref?: any
}
