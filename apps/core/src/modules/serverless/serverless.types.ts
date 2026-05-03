import type { EntityId } from '~/shared/id/entity-id'

export interface ServerlessStorageRow {
  id: EntityId
  namespace: string
  key: string
  value: unknown
}

export interface ServerlessLogRow {
  id: EntityId
  functionId: EntityId | null
  reference: string
  name: string
  method: string | null
  ip: string | null
  status: string
  executionTime: number
  logs: unknown[] | null
  error: Record<string, unknown> | null
  createdAt: Date
}
