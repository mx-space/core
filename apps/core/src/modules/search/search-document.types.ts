export type SearchDocumentRefType = 'post' | 'note' | 'page'

export interface SearchDocumentModel {
  id?: string
  refType: SearchDocumentRefType
  refId: string
  title: string
  searchText: string
  terms: string[]
  titleTermFreq: Record<string, number>
  bodyTermFreq: Record<string, number>
  titleLength: number
  bodyLength: number
  slug?: string | null
  nid?: number | null
  isPublished?: boolean
  hasPassword?: boolean
  publicAt?: Date | null
  createdAt?: Date | null
  modifiedAt?: Date | null
}

export interface SearchDocumentRow {
  id: string
  refType: SearchDocumentRefType
  refId: string
  title: string
  searchText: string
  terms: string[]
  titleTermFreq: Record<string, number>
  bodyTermFreq: Record<string, number>
  titleLength: number
  bodyLength: number
  slug: string | null
  nid: number | null
  isPublished: boolean
  publicAt: Date | null
  hasPassword: boolean
  createdAt: Date
  modifiedAt: Date | null
}

export interface SearchDocumentUpsertInput extends Omit<
  SearchDocumentRow,
  'id' | 'createdAt'
> {
  id?: string
}
