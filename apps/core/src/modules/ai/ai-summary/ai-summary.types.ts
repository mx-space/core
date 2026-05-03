import type { EntityId } from '~/shared/id/entity-id'
import type { BaseModel } from '~/shared/types/legacy-model.type'

export interface AISummaryModel extends BaseModel {
  id: string
  hash: string
  summary: string
  refId: string
  lang?: string | null
}

export interface AiSummaryRow {
  id: EntityId
  hash: string
  summary: string
  refId: EntityId
  lang: string | null
  createdAt: Date
}
