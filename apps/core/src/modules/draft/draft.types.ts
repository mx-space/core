import type { EntityId } from '~/shared/id/entity-id'
import type { ContentFormat } from '~/shared/types/content-format.type'
import type { BaseModel, ImageModel } from '~/shared/types/legacy-model.type'

import type { DraftRefType } from './draft.enum'

export type { DraftRefType }

export interface DraftHistoryModel {
  version: number
  title: string
  text?: string
  contentFormat: ContentFormat
  content?: string
  typeSpecificData?: string
  savedAt: Date
  isFullSnapshot: boolean
  refVersion?: number
  baseVersion?: number
}

export interface DraftModel extends BaseModel {
  refType: DraftRefType
  refId?: any
  title: string
  text: string
  contentFormat: ContentFormat
  content?: string
  images?: ImageModel[]
  meta?: Record<string, any>
  typeSpecificData?: string
  version: number
  publishedVersion?: number
  updated?: Date
  history: DraftHistoryModel[]
}

export const DRAFT_PROTECTED_KEYS = [
  'version',
  'history',
  'updated',
  'publishedVersion',
  'createdAt',
  'id',
]

export interface DraftHistoryEntry {
  version: number
  title: string
  text?: string
  contentFormat: string
  content?: string
  typeSpecificData?: string
  savedAt: string
  isFullSnapshot: boolean
  refVersion?: number
  baseVersion?: number
}

export interface DraftRow {
  id: EntityId
  refType: DraftRefType
  refId: EntityId | null
  title: string
  text: string
  content: string | null
  contentFormat: string
  images: unknown[] | null
  meta: Record<string, unknown> | null
  typeSpecificData: Record<string, unknown> | null
  history: DraftHistoryEntry[]
  version: number
  publishedVersion: number | null
  createdAt: Date
  updatedAt: Date | null
}

export interface DraftCreateInput {
  refType: DraftRefType
  refId?: EntityId | string | null
  contentFormat: string
  title?: string
  text?: string
  content?: string | null
  images?: unknown[] | null
  meta?: Record<string, unknown> | null
  typeSpecificData?: Record<string, unknown> | null
}

export type DraftPatchInput = Partial<DraftCreateInput> & {
  version?: number
  publishedVersion?: number | null
  history?: DraftHistoryEntry[]
}

export interface DraftListFilter {
  refType?: DraftRefType
  search?: string
  hasRef?: boolean
}
