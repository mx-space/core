import type { EntityId } from '~/shared/id/entity-id'

export interface OptionRow {
  id: EntityId
  name: string
  value: unknown
}
