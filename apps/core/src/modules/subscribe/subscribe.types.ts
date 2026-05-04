import type { EntityId } from '~/shared/id/entity-id'

export interface SubscribeRow {
  id: EntityId
  email: string
  cancelToken: string
  subscribe: number
  verified: boolean
  createdAt: Date
}
