import type { BaseModel } from '~/shared/types/legacy-model.type'

export interface TopicModel extends BaseModel {
  name: string
  slug: string
  description?: string
  introduce?: string | null
  icon?: string | null
}
