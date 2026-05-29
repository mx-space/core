import type { LinkModel, LinkResponse, LinkStateCount } from '~/models/link'

import {
  deleteJson,
  getJson,
  patchJson,
  postJson,
  putJson,
  requestJson,
} from './http'

export interface GetLinksParams {
  page: number
  size: number
  state: number
}

export interface LinkInput {
  avatar?: string
  description?: string
  name: string
  state?: number
  type?: number
  url: string
}

export function getLinks(params: GetLinksParams) {
  return getJson<LinkResponse>('/links', {
    page: params.page,
    size: params.size,
    state: params.state,
  })
}

export function getLinkStateCount() {
  return getJson<LinkStateCount>('/links/state')
}

export function createLink(data: LinkInput) {
  return postJson<LinkModel, LinkInput>('/links', data)
}

export function updateLink(id: string, data: Partial<LinkInput>) {
  return putJson<LinkModel, Partial<LinkInput>>(`/links/${id}`, data)
}

export function deleteLink(id: string) {
  return deleteJson<void>(`/links/${id}`)
}

export function auditPassLink(id: string) {
  return requestJson<LinkModel>(`/links/audit/${id}`, { method: 'PATCH' })
}

export function auditLinkWithReason(
  id: string,
  data: { reason: string; state: number },
) {
  return postJson<void, typeof data>(`/links/audit/reason/${id}`, data)
}

export function updateLinkState(id: string, state: number) {
  return patchJson<LinkModel, { state: number }>(`/links/${id}`, { state })
}

export function checkLinksHealth() {
  return getJson<
    Record<string, { id: string; message?: string; status: number | string }>
  >('/links/health')
}

export function migrateLinkAvatars() {
  return requestJson<void>('/links/avatar/migrate', { method: 'POST' })
}
