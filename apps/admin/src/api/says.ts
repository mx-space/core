import type { SayModel, SayResponse } from '~/models/say'

import { deleteJson, getJson, postJson, putJson } from './http'

export interface SayInput {
  author?: string
  source?: string
  text: string
}

export function getSays(params: { page: number; size: number }) {
  return getJson<SayResponse>('/says', params)
}

export function createSay(data: SayInput) {
  return postJson<SayModel, SayInput>('/says', data)
}

export function updateSay(id: string, data: Partial<SayInput>) {
  return putJson<SayModel, Partial<SayInput>>(`/says/${id}`, data)
}

export function deleteSay(id: string) {
  return deleteJson<void>(`/says/${id}`)
}
