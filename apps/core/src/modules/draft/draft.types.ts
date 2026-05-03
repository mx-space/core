import type { ContentFormat } from '~/shared/types/content-format.type'
import type { BaseModel, ImageModel } from '~/shared/types/legacy-model.type'

import type { DraftRefType } from './draft.enum'

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
  'created',
  'id',
  '_id',
]
