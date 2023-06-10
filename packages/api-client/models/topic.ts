import type { BaseModel } from './base'

export interface TopicModel extends BaseModel {
  description?: string
  introduce: string
  name: string
  slug: string
  icon?: string
}
