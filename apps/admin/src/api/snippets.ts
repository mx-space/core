import type { PaginateResult } from '~/models/base'
import type { SnippetModel, SnippetType } from '~/models/snippet'

import { deleteJson, getJson, postJson, putJson } from './http'

export interface GetSnippetsParams {
  page?: number
  reference?: string
  size?: number
  type?: SnippetType
}

export interface CreateSnippetData {
  comment?: string
  customPath?: string
  enable?: boolean
  metatype?: string
  method?: string
  name: string
  private?: boolean
  raw: string
  reference?: string
  schema?: string
  secret?: Record<string, unknown> | string | null
  type: SnippetType
}

export interface SnippetGroup {
  count: number
  reference: string
}

export interface ImportSnippetsData {
  packages?: string[]
  snippets: Array<CreateSnippetData | SnippetModel>
}

export function getSnippets(params: GetSnippetsParams = {}) {
  return getJson<PaginateResult<SnippetModel>>('/snippets', {
    page: params.page,
    reference: params.reference,
    size: params.size,
    type: params.type,
  })
}

export function getSnippetById(id: string) {
  return getJson<SnippetModel>(`/snippets/${id}`)
}

export function createSnippet(data: CreateSnippetData) {
  return postJson<SnippetModel, CreateSnippetData>('/snippets', data)
}

export function updateSnippet(id: string, data: Partial<CreateSnippetData>) {
  return putJson<SnippetModel, Partial<CreateSnippetData>>(
    `/snippets/${id}`,
    data,
  )
}

export function deleteSnippet(id: string) {
  return deleteJson<void>(`/snippets/${id}`)
}

export function getSnippetGroups(params?: { page?: number; size?: number }) {
  return getJson<PaginateResult<SnippetGroup>>('/snippets/group', {
    page: params?.page,
    size: params?.size,
  })
}

export function getGroupSnippets(reference: string) {
  return getJson<SnippetModel[]>(
    `/snippets/group/${encodeURIComponent(reference)}`,
  )
}

export function resetFunctionSnippet(id: string) {
  return deleteJson<void>(`/fn/reset/${id}`)
}

export function importSnippets(data: ImportSnippetsData) {
  return postJson<void, ImportSnippetsData>('/snippets/import', data)
}
