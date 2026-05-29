import type { PaginateResult } from '~/models/base'

import { getJson, patchJson } from './http'

export type ReaderRole = 'reader' | 'owner'
export type ReaderRoleFilter = 'all' | 'owner' | 'reader'

export interface ReaderModel {
  id: string
  email: string | null
  emailVerified: boolean
  name: string | null
  handle: string | null
  username: string | null
  displayUsername: string | null
  image: string | null
  role: ReaderRole
  bannedAt: string | null
  banReason: string | null
  createdAt: string
  updatedAt: string | null
  lastLoginAt: string | null
}

export interface ReaderStats {
  all: number
  owner: number
  reader: number
  banned: number
}

export interface ReaderListParams {
  page: number
  size: number
  search?: string
  role?: ReaderRoleFilter
}

export function getReaders(params: ReaderListParams) {
  return getJson<PaginateResult<ReaderModel>>('/readers', {
    page: params.page,
    role: params.role,
    search: params.search,
    size: params.size,
  })
}

export function getReaderStats() {
  return getJson<ReaderStats>('/readers/stats')
}

export function getReader(id: string) {
  return getJson<ReaderModel>(`/readers/${id}`)
}

export function transferOwner(id: string) {
  return patchJson<unknown, { id: string }>('/readers/transfer-owner', { id })
}

export function revokeOwner(id: string) {
  return patchJson<unknown, { id: string }>('/readers/revoke-owner', { id })
}

export function banReader(id: string, reason?: string) {
  return patchJson<ReaderModel, { reason?: string }>(`/readers/${id}/ban`, {
    reason,
  })
}

export function unbanReader(id: string) {
  return patchJson<ReaderModel, Record<string, never>>(
    `/readers/${id}/unban`,
    {},
  )
}
