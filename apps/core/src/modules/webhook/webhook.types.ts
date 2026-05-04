import type { EntityId } from '~/shared/id/entity-id'

export interface WebhookModel {
  id?: string
  timestamp?: Date | null
  payloadUrl: string
  events: string[]
  enabled?: boolean
  secret: string
  scope?: number | null
}

export interface WebhookEventModel {
  id?: string
  timestamp?: Date | null
  headers?: Record<string, unknown> | null
  payload?: unknown
  event?: string | null
  response?: unknown
  success?: boolean | null
  hookId: string
  status?: number
}

export interface WebhookRow {
  id: EntityId
  payloadUrl: string
  events: string[]
  enabled: boolean
  scope: number | null
  /** Timestamp recorded at creation; named `timestamp` in the legacy schema. */
  timestamp: Date | null
}

export interface WebhookEventRow {
  id: EntityId
  hookId: EntityId
  event: string | null
  headers: Record<string, unknown> | null
  payload: unknown
  response: unknown
  success: boolean | null
  status: number
  timestamp: Date | null
}
