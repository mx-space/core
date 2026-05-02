import type { BaseModel } from '~/shared/types/legacy-model.type'

export interface AIInsightsModel extends BaseModel {
  id: string
  refId: string
  lang: string
  hash: string
  content: string
  isTranslation?: boolean
  sourceInsightsId?: string | null
  sourceLang?: string | null
  modelInfo?: Record<string, unknown> | null
}
