import type { Image, PaginateResult } from '~/models/base'
import type {
  ContentRevision,
  DraftModel,
  DraftRefType,
  RevisionComparison,
  TypeSpecificData,
  VersionContext,
} from '~/models/draft'

import { deleteJson, getJson, postJson, putJson } from './http'

export type DraftSortOrder = 'asc' | 'desc'

export interface GetDraftsParams {
  hasRef?: boolean
  page?: number
  refType?: DraftRefType
  search?: string
  size?: number
  sort_by?: string
  sort_order?: DraftSortOrder
}

export interface DraftWriteData {
  content?: string
  contentFormat: 'lexical' | 'markdown'
  images?: Image[] | null
  meta?: Record<string, unknown> | null
  text: string
  title: string
  typeSpecificData?: TypeSpecificData | null
}

export interface CreateDraftData {
  baseRevisionId?: string | null
  data: DraftWriteData
  refId?: string
  refType: DraftRefType
}

export interface UpdateDraftData {
  data: DraftWriteData
  expectedHeadRevisionId: string
}

export function getDrafts(params: GetDraftsParams = {}) {
  return getJson<PaginateResult<DraftModel>>('/drafts', {
    hasRef: params.hasRef === undefined ? undefined : String(params.hasRef),
    page: params.page,
    refType: params.refType,
    search: params.search,
    size: params.size,
    sort_by: params.sort_by,
    sort_order: params.sort_order,
  })
}

export function getDraftById(id: string) {
  return getJson<DraftModel>(`/drafts/${id}`)
}

export function getDraftContext(refType: DraftRefType, refId: string) {
  return getJson<VersionContext>(`/drafts/context/${refType}/${refId}`)
}

export function getNewDrafts(refType: DraftRefType) {
  return getJson<DraftModel[]>(`/drafts/new/${refType}`)
}

export function compareRevisions(leftId: string, rightId: string) {
  return getJson<RevisionComparison>(`/drafts/compare/${leftId}/${rightId}`)
}

export function getRevision(id: string) {
  return getJson<ContentRevision>(`/drafts/revisions/${id}`)
}

export function getDraftRevisions(id: string) {
  return getJson<ContentRevision[]>(`/drafts/${id}/revisions`)
}

export function createDraft(data: CreateDraftData) {
  return postJson<DraftModel, CreateDraftData>('/drafts', data)
}

export function updateDraft(id: string, data: UpdateDraftData) {
  return putJson<DraftModel, UpdateDraftData>(`/drafts/${id}`, data)
}

export function deleteDraft(id: string) {
  return deleteJson<{ success: boolean }>(`/drafts/${id}`)
}
