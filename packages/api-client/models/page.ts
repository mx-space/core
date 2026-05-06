import type { Image } from './base'
import type { EnrichmentResult } from './recently'

export type PageEnrichmentMap = Record<string, EnrichmentResult>

export enum EnumPageType {
  'md' = 'md',
  'html' = 'html',
  'frame' = 'frame',
}

export interface PageModelMarkdown {
  id: string
  createdAt: string
  modifiedAt: string | null
  title: string
  slug: string
  subtitle?: string | null
  text: string
  contentFormat?: 'markdown'
  content?: undefined
  meta?: Record<string, any> | null
  images?: Image[] | null
  order?: number
  type?: EnumPageType
  options?: object
  enrichments?: PageEnrichmentMap
}

export interface PageModelLexical {
  id: string
  createdAt: string
  modifiedAt: string | null
  title: string
  slug: string
  subtitle?: string | null
  text?: string
  contentFormat: 'lexical'
  content: string
  meta?: Record<string, any> | null
  images?: Image[] | null
  order?: number
  type?: EnumPageType
  options?: object
  enrichments?: PageEnrichmentMap
}

export type PageModel = PageModelMarkdown | PageModelLexical
