import type { Image, PaginateResult } from '~/models/base'
import type {
  DraftHistoryListItem,
  DraftModel,
  DraftRefType,
  TypeSpecificData,
} from '~/models/draft'

import { deleteJson, getJson, postJson, putJson } from './http'

export type DraftSortOrder = 'asc' | 'desc'

export interface GetDraftsParams {
  hasRef?: boolean
  page?: number
  refType?: DraftRefType
  size?: number
  sort_by?: string
  sort_order?: DraftSortOrder
}

export interface CreateDraftData {
  content?: string
  contentFormat?: 'lexical' | 'markdown'
  images?: Image[]
  meta?: Record<string, unknown>
  refId?: string
  refType: DraftRefType
  text?: string
  title?: string
  typeSpecificData?: TypeSpecificData
}

export function getDrafts(params: GetDraftsParams = {}) {
  return getJson<PaginateResult<DraftModel>>('/drafts', {
    hasRef: params.hasRef === undefined ? undefined : String(params.hasRef),
    page: params.page,
    refType: params.refType,
    size: params.size,
    sort_by: params.sort_by,
    sort_order: params.sort_order,
  })
}

export function getDraftById(id: string) {
  return getJson<DraftModel>(`/drafts/${id}`)
}

export function getDraftByRef(refType: DraftRefType, refId: string) {
  return getJson<DraftModel | null>(`/drafts/by-ref/${refType}/${refId}`)
}

export function getNewDrafts(refType: DraftRefType) {
  return getJson<DraftModel[]>(`/drafts/by-ref/${refType}/new`)
}

export function getDraftHistory(id: string) {
  return getJson<DraftHistoryListItem[]>(`/drafts/${id}/history`)
}

export function getDraftHistoryVersion(id: string, version: number) {
  return getJson<DraftModel>(`/drafts/${id}/history/${version}`)
}

export function createDraft(data: CreateDraftData) {
  return postJson<DraftModel, CreateDraftData>('/drafts', data)
}

export function updateDraft(id: string, data: Partial<CreateDraftData>) {
  return putJson<DraftModel, Partial<CreateDraftData>>(`/drafts/${id}`, data)
}

export function deleteDraft(id: string) {
  return deleteJson<{ success: boolean }>(`/drafts/${id}`)
}

export function restoreDraftVersion(id: string, version: number) {
  return postJson<DraftModel, Record<string, never>>(
    `/drafts/${id}/restore/${version}`,
    {},
  )
}
