import type { PaginateResult } from '~/models/base'

import { deleteJson, getJson, patchJson, postJson } from './http'

export interface WebhookModel {
  created: string
  enabled: boolean
  events: string[]
  id: string
  payloadUrl: string
  scope: number
  secret?: string
  updated: string
  url: string
}

export interface WebhookInput {
  enabled?: boolean
  events: string[]
  payloadUrl?: string
  scope?: number
  secret?: string
  url?: string
}

export interface WebhookEventRecord {
  event: string
  headers: Record<string, string>
  hookId: string
  id: string
  payload: unknown
  response: unknown
  status: number
  success: boolean
  timestamp: string
}

export const EventScope = {
  ALL: (1 << 0) | (1 << 1) | (1 << 2),
  TO_ADMIN: 1 << 1,
  TO_SYSTEM: 1 << 2,
  TO_VISITOR: 1 << 0,
} as const

export function getWebhooks() {
  return getJson<WebhookModel[]>('/webhooks')
}

export function getWebhookEvents() {
  return getJson<string[]>('/webhooks/events')
}

export function createWebhook(data: WebhookInput) {
  return postJson<WebhookModel, WebhookInput>('/webhooks', data)
}

export function updateWebhook(id: string, data: Partial<WebhookInput>) {
  return patchJson<WebhookModel, Partial<WebhookInput>>(`/webhooks/${id}`, data)
}

export function deleteWebhook(id: string) {
  return deleteJson<void>(`/webhooks/${id}`)
}

export function testWebhook(id: string, event: string) {
  return postJson<void, { event: string }>(`/webhooks/${id}/test`, { event })
}

export function getWebhookDispatches(
  id: string,
  params: { page: number; size: number },
) {
  return getJson<PaginateResult<WebhookEventRecord>>(`/webhooks/${id}`, {
    page: params.page,
    size: params.size,
  })
}

export function redispatchWebhook(hookId: string, eventId: string) {
  return postJson<void, Record<string, never>>(
    `/webhooks/${hookId}/redispatch/${eventId}`,
    {},
  )
}
