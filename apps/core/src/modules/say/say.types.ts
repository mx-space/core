import type { EntityId } from '~/shared/id/entity-id'

export interface SayRow {
  id: EntityId
  text: string
  source: string | null
  author: string | null
  createdAt: Date
}

export interface SayCreateInput {
  text: string
  source?: string | null
  author?: string | null
}

export type SayPatchInput = Partial<SayCreateInput>
