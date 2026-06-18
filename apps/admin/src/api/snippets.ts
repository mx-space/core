import type { SnippetModel, SnippetType } from '~/models/snippet'

import { deleteJson, getJson, postJson, putJson } from './http'

export interface GetSnippetsParams {
  limit?: number
  prefix?: string
  recursive?: boolean
  type?: SnippetType
}

export interface CreateSnippetData {
  comment?: string
  enable?: boolean
  metatype?: string
  method?: string
  path: string
  private?: boolean
  raw: string
  schema?: string
  secret?: Record<string, unknown> | string | null
  type: SnippetType
}

export interface SnippetObject {
  id: string
  path: string
  type: SnippetType
  comment?: string | null
  private: boolean
  enable: boolean
  method?: string | null
  updatedAt?: string | null
}

export interface SnippetVfsList {
  prefix: string
  objects: SnippetObject[]
  commonPrefixes: string[]
}

export interface ImportSnippetsData {
  packages?: string[]
  snippets: Array<CreateSnippetData | SnippetModel>
}

export interface MoveSnippetData {
  from: string
  recursive: boolean
  to: string
}

export function getSnippets(params: GetSnippetsParams = {}) {
  return getJson<SnippetVfsList>('/snippets', {
    limit: params.limit,
    prefix: params.prefix,
    recursive: params.recursive,
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

export function resetFunctionSnippet(id: string) {
  return deleteJson<void>(`/fn/reset/${id}`)
}

export function importSnippets(data: ImportSnippetsData) {
  return postJson<void, ImportSnippetsData>('/snippets/import', data)
}

export function moveSnippet(data: MoveSnippetData) {
  return postJson<void, MoveSnippetData>('/snippets/move', data)
}

export function deleteSnippetByPath(path: string, recursive = true) {
  return deleteJson<void>(
    `/snippets/by-path?path=${encodeURIComponent(path)}&recursive=${recursive}`,
  )
}
