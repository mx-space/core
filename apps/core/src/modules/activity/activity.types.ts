import type { EntityId } from '~/shared/id/entity-id'

export interface ActivityRow {
  id: EntityId
  type: number | null
  payload: Record<string, unknown> | null
  createdAt: Date
}
