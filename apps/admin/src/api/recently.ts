import type { RecentlyModel } from '~/models/recently'

import { deleteJson, getJson, postJson, putJson } from './http'

export interface RecentlyInput {
  content: string
}

export interface RecentlyListParams {
  [key: string]: boolean | number | string | undefined
  after?: string
  before?: string
  size?: number
}

export function getRecentlyList(params: RecentlyListParams = {}) {
  return getJson<RecentlyModel[]>('/recently', params)
}

export function createRecently(data: RecentlyInput) {
  return postJson<RecentlyModel, RecentlyInput>('/recently', data)
}

export function updateRecently(id: string, data: RecentlyInput) {
  return putJson<RecentlyModel, RecentlyInput>(`/recently/${id}`, data)
}

export function deleteRecently(id: string) {
  return deleteJson<void>(`/recently/${id}`)
}
