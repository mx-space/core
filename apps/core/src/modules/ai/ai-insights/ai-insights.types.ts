import type { EntityId } from '~/shared/id/entity-id'
import type { BaseModel } from '~/shared/types/legacy-model.type'

import type { GenerationMetricsDto } from '../ai-generation-metrics/ai-generation-metrics.types'

export interface AIInsightsModel extends BaseModel {
  id: string
  refId: string
  lang: string
  hash: string
  content: string
  isTranslation?: boolean
  sourceInsightsId?: string | null
  sourceLang?: string | null
  /** @deprecated use generationMetrics; column retained one release for rolling deploy */
  modelInfo?: Record<string, unknown> | null
  generationMetrics?: GenerationMetricsDto | null
}

export interface AiInsightsRow {
  id: EntityId
  refId: EntityId
  lang: string
  hash: string
  content: string
  isTranslation: boolean
  sourceInsightsId: EntityId | null
  sourceLang: string | null
  modelInfo: Record<string, unknown> | null
  createdAt: Date
}
