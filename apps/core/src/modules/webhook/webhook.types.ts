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
