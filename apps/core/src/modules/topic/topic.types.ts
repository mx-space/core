import type { EntityId } from '~/shared/id/entity-id'

export interface TopicModel {
  id: string
  createdAt: string
  name: string
  slug: string
  description: string
  introduce: string | null
  icon: string | null
}

export interface TopicRow {
  id: EntityId
  name: string
  slug: string
  description: string
  introduce: string | null
  icon: string | null
  createdAt: Date
}

export interface TopicCreateInput {
  name: string
  slug?: string
  description?: string
  introduce?: string | null
  icon?: string | null
}

export type TopicPatchInput = Partial<TopicCreateInput>
