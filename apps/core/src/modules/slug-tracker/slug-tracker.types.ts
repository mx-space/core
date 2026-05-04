import type { EntityId } from '~/shared/id/entity-id'

export interface SlugTrackerRow {
  id: EntityId
  slug: string
  type: string
  targetId: EntityId
}
