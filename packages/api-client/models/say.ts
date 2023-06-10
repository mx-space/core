import type { BaseModel } from './base'

export interface SayModel extends BaseModel {
  text: string
  source?: string
  author?: string
}
