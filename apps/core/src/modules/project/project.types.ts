import type { EntityId } from '~/shared/id/entity-id'

export interface ProjectRow {
  id: EntityId
  name: string
  description: string
  previewUrl: string | null
  docUrl: string | null
  projectUrl: string | null
  images: string[] | null
  avatar: string | null
  text: string | null
  createdAt: Date
}

export interface ProjectCreateInput {
  name: string
  description: string
  previewUrl?: string | null
  docUrl?: string | null
  projectUrl?: string | null
  images?: string[] | null
  avatar?: string | null
  text?: string | null
}

export type ProjectPatchInput = Partial<ProjectCreateInput>
