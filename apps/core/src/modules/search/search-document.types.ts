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
  created?: Date | null
  modified?: Date | null
}
