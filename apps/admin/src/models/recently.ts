import type { EnrichmentResult } from './enrichment'

export enum RecentlyRefTypes {
  Post = 'post',
  Note = 'note',
  Page = 'page',
  Recently = 'recently',
}

export interface RecentlyRefType {
  title: string
  url: string
}

export interface RecentlyModel {
  id: string
  content: string
  createdAt: string
  modifiedAt: string | null

  ref?: RecentlyRefType & { [key: string]: any }
  refId?: string
  refType?: RecentlyRefTypes

  enrichments?: Record<string, EnrichmentResult>

  up: number
  down: number

  allowComment: boolean
  commentsIndex?: number
}
