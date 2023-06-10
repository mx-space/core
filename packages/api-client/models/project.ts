import type { BaseModel } from './base'

export interface ProjectModel extends BaseModel {
  name: string
  previewUrl?: string
  docUrl?: string
  projectUrl?: string
  images?: string[]
  description: string
  avatar?: string
  text: string
}
