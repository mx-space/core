import { getJson, requestJson } from './http'

export interface SearchIndexLegacyPager {
  currentPage: number
  hasNextPage: boolean
  hasPrevPage: boolean
  size: number
  total: number
  totalPage: number
}

export type SearchIndexRefType = 'note' | 'page' | 'post'

export interface SearchIndexRebuildResult {
  created: number
  deleted: number
  skipped: number
  total: number
  updated: number
}

export interface SearchIndexRebuildOneResult {
  rebuilt: number
}

export interface SearchDocumentAdminRow {
  bodyLength: number
  createdAt: string
  hasPassword: boolean
  id: string
  isPublished: boolean
  lang: string
  modifiedAt: string
  publicAt: string | null
  refId: string
  refType: SearchIndexRefType | string
  sourceHash: string
  title: string
  titleLength: number
}

export interface SearchDocumentAdminListResponse {
  data: SearchDocumentAdminRow[]
  pagination: SearchIndexLegacyPager
}

export interface SearchDocumentAdminListParams {
  keyword?: string
  lang?: string
  page?: number
  refType?: SearchIndexRefType | string
  size?: number
}

export function rebuildSearchIndex(force = false) {
  return requestJson<SearchIndexRebuildResult>(
    force ? '/search/rebuild?force=true' : '/search/rebuild',
    {
      method: 'POST',
    },
  )
}

export function rebuildSearchIndexDocument(refType: string, refId: string) {
  return requestJson<SearchIndexRebuildOneResult>(
    `/search/rebuild/${encodeURIComponent(refType)}/${encodeURIComponent(refId)}`,
    {
      method: 'POST',
    },
  )
}

export function getSearchIndexDocuments(
  params: SearchDocumentAdminListParams = {},
) {
  return getJson<SearchDocumentAdminListResponse>('/search/admin/documents', {
    keyword: params.keyword,
    lang: params.lang,
    page: params.page,
    refType: params.refType,
    size: params.size,
  })
}
