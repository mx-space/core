import type { BaseModel } from '~/shared/types/legacy-model.type'

export interface AISummaryModel extends BaseModel {
  id: string
  hash: string
  summary: string
  refId: string
  lang?: string | null
}
