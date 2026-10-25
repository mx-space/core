import type { Image, PaginateResult } from '~/models/base'
import type {
  CleanupCategory,
  CleanupPreview,
  CleanupResult,
  CompactPreview,
  ContentRevision,
  CrdtOpId,
  DraftCard,
  DraftFields,
  DraftHistory,
  DraftModel,
  DraftRefType,
  DraftRelation,
  DraftShare,
  DraftStorageSummary,
  FreedTotals,
  OrganizerArticle,
  OrganizerResult,
  OrganizerRunResult,
  RevisionComparison,
  TypeSpecificData,
  VersionContext,
} from '~/models/draft'

import {
  deleteJson,
  getJson,
  patchJson,
  postJson,
  putJson,
  requestBytes,
} from './http'

export type DraftSortOrder = 'asc' | 'desc'

export interface GetDraftsParams {
  hasRef?: boolean
  page?: number
  refType?: DraftRefType
  relation?: DraftRelation
  search?: string
  size?: number
  sort?: 'size' | 'updated'
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
  return getJson<PaginateResult<DraftCard>>('/drafts', {
    hasRef: params.hasRef === undefined ? undefined : String(params.hasRef),
    page: params.page,
    refType: params.refType,
    relation: params.relation,
    search: params.search,
    size: params.size,
    sort: params.sort,
    sort_by: params.sort_by,
    sort_order: params.sort_order,
  })
}

export function getDraftById(id: string) {
  return getJson<DraftModel>(`/drafts/${id}`)
}

export function getDraftPreview(id: string) {
  return getJson<DraftModel>(`/drafts/${id}/preview`)
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

export type SetDraftShareData =
  { draftId: string; mode: 'follow' } | { mode: 'pinned'; revisionId: string }

export function getDraftShare(documentId: string) {
  return getJson<DraftShare | null>(`/drafts/documents/${documentId}/share`)
}

export function setDraftShare(documentId: string, data: SetDraftShareData) {
  return putJson<DraftShare, SetDraftShareData>(
    `/drafts/documents/${documentId}/share`,
    data,
  )
}

export function deleteDraftShare(documentId: string) {
  return deleteJson<{ success: boolean }>(
    `/drafts/documents/${documentId}/share`,
  )
}

export function createDraft(data: CreateDraftData) {
  return postJson<DraftModel, CreateDraftData>('/drafts', data)
}

export function updateDraft(id: string, data: UpdateDraftData) {
  return putJson<DraftModel, UpdateDraftData>(`/drafts/${id}`, data)
}

export function deleteDraft(id: string) {
  return deleteJson<FreedTotals>(`/drafts/${id}`)
}

export function batchDeleteDrafts(ids: string[]) {
  return postJson<CleanupResult, { ids: string[] }>('/drafts/batch-delete', {
    ids,
  })
}

export function getDraftStorage(refType?: DraftRefType) {
  return getJson<DraftStorageSummary>('/drafts/storage', { refType })
}

export function getOrganizerPreview(params: {
  olderThanDays: number
  refType?: DraftRefType
  search?: string
}) {
  return getJson<OrganizerArticle[]>('/drafts/organize/preview', params)
}

export async function runDraftOrganizer(
  articles: OrganizerArticle[],
  discardChanges: boolean,
  onProgress?: (processed: number) => void,
): Promise<OrganizerRunResult> {
  const result: OrganizerRunResult = {
    freed: { bytes: 0, drafts: 0, revisions: 0, crdtDocs: 0 },
    organized: 0,
    skipped: [],
    unverified: [],
  }
  for (let offset = 0; offset < articles.length; offset += 100) {
    const batch = articles.slice(offset, offset + 100)
    let next: OrganizerResult
    try {
      next = await postJson<
        OrganizerResult,
        {
          discardChanges: boolean
          items: { documentId: string; version: string }[]
        }
      >('/drafts/organize', {
        discardChanges,
        items: batch.map(({ documentId, version }) => ({
          documentId,
          version,
        })),
      })
    } catch {
      // A lost response can follow a committed deletion; never claim these drafts were retained.
      result.unverified = articles.slice(offset)
      break
    }
    result.organized += next.organized
    result.skipped.push(...next.skipped)
    for (const key of ['bytes', 'drafts', 'revisions', 'crdtDocs'] as const)
      result.freed[key] += next.freed[key]
    onProgress?.(offset + batch.length)
  }
  return result
}

export function getCleanupPreview(olderThanDays: number) {
  return getJson<CleanupPreview>('/drafts/cleanup/preview', {
    olderThanDays,
  })
}

export interface RunCleanupData {
  archivedDraftIds?: string[]
  categories: CleanupCategory[]
  olderThanDays: number
}

export function runCleanup(data: RunCleanupData) {
  return postJson<CleanupResult, RunCleanupData>('/drafts/cleanup', data)
}

export function getCompactPreview(id: string) {
  return getJson<CompactPreview>(`/drafts/${id}/compact/preview`)
}

export function compactDraft(id: string) {
  return postJson<FreedTotals, Record<string, never>>(
    `/drafts/${id}/compact`,
    {},
  )
}

const encodeBase64 = (bytes: Uint8Array) =>
  btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))

export function getDraftCrdt(id: string, since?: Uint8Array) {
  const query = since ? `?since=${encodeURIComponent(encodeBase64(since))}` : ''
  return requestBytes(`/drafts/${id}/crdt${query}`, { method: 'GET' })
}

export async function postDraftCrdt(id: string, bytes: Uint8Array) {
  await requestBytes(`/drafts/${id}/crdt`, {
    body: bytes as Uint8Array<ArrayBuffer>,
    headers: { 'content-type': 'application/octet-stream' },
    method: 'POST',
  })
}

export function createDraftCheckpoint(id: string, kind: 'publish' | 'save') {
  return postJson<DraftModel, { kind: 'publish' | 'save' }>(
    `/drafts/${id}/checkpoints`,
    { kind },
  )
}

export function updateDraftFields(
  id: string,
  patch: Partial<Record<keyof DraftFields, Record<string, unknown>>>,
) {
  return patchJson<DraftFields, typeof patch>(`/drafts/${id}/fields`, patch)
}

export function getDraftHistory(id: string) {
  return getJson<DraftHistory>(`/drafts/${id}/history`)
}

export function restoreDraftRevision(id: string, revisionId: string) {
  return postJson<DraftModel, { revisionId: string }>(`/drafts/${id}/restore`, {
    revisionId,
  })
}

export function undoDraftChange(
  id: string,
  change: CrdtOpId,
  before: CrdtOpId[],
) {
  return postJson<DraftModel, { before: CrdtOpId[]; id: CrdtOpId }>(
    `/drafts/${id}/undo`,
    { before, id: change },
  )
}
