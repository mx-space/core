import type { Image } from './base'
import type { CategoryModel } from './category'
import type { EnrichmentResult } from './enrichment'

export type PostContentFormat = 'markdown' | 'lexical'

/**
 * Server-side bulk lookup of cached enrichments for URLs found in the doc
 * body. Keyed by the original URL string. Absent or partial when the cache
 * does not (yet) cover every URL — frontend cold-path resolves the rest via
 * `/enrichment/resolve`.
 */
export type EnrichmentMap = Record<string, EnrichmentResult>

export interface PostModelMarkdown {
  id: string
  createdAt: string
  modifiedAt: string | null
  title: string
  text: string
  contentFormat?: 'markdown'
  content?: undefined
  meta?: Record<string, any> | null
  summary?: string | null
  copyright: boolean
  tags: string[]
  slug: string
  categoryId: string
  category: CategoryModel
  images?: Image[] | null
  isPublished: boolean
  readCount: number
  likeCount: number
  pinAt?: string | null
  pinOrder?: number | null
  related?: PostRelatedSummary[]
  enrichments?: EnrichmentMap
  isPremium: boolean
}

export interface PostModelLexical {
  id: string
  createdAt: string
  modifiedAt: string | null
  title: string
  text?: string
  contentFormat: 'lexical'
  content: string
  meta?: Record<string, any> | null
  summary?: string | null
  copyright: boolean
  tags: string[]
  slug: string
  categoryId: string
  category: CategoryModel
  images?: Image[] | null
  isPublished: boolean
  readCount: number
  likeCount: number
  pinAt?: string | null
  pinOrder?: number | null
  related?: PostRelatedSummary[]
  enrichments?: EnrichmentMap
  isPremium: boolean
}

export type PostModel = PostModelMarkdown | PostModelLexical

export interface PostRelatedSummary {
  id: string
  title: string
  slug: string
  summary: string | null
  categoryId: string
  category?: CategoryModel
  createdAt: string
  modifiedAt: string | null
}
