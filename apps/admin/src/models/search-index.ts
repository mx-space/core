export interface SearchIndexLegacyPager {
  total: number
  size: number
  currentPage: number
  totalPage: number
  hasPrevPage: boolean
  hasNextPage: boolean
}

export type SearchIndexRefType = 'post' | 'note' | 'page'

export interface SearchIndexRebuildResult {
  total: number
  created: number
  updated: number
  deleted: number
  skipped: number
}

export interface SearchIndexRebuildOneResult {
  rebuilt: number
}

export interface SearchDocumentAdminRow {
  id: string
  refType: SearchIndexRefType | string
  refId: string
  lang: string
  title: string
  titleLength: number
  bodyLength: number
  sourceHash: string
  isPublished: boolean
  publicAt: string | null
  hasPassword: boolean
  modifiedAt: string
  createdAt: string
}

export interface SearchDocumentAdminListResponse {
  data: SearchDocumentAdminRow[]
  pagination: SearchIndexLegacyPager
}

export interface SearchDocumentAdminListParams {
  refType?: SearchIndexRefType | string
  lang?: string
  keyword?: string
  page?: number
  size?: number
}
