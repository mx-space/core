import type { Image, ModelWithLiked, ModelWithTranslation } from './base'
import type { EnrichmentResult } from './recently'
import type { TopicModel } from './topic'

export type NoteEnrichmentMap = Record<string, EnrichmentResult>

export interface NoteModel {
  id: string
  nid: number
  title: string
  slug?: string | null
  text: string
  content?: string | null
  contentFormat: 'markdown' | 'lexical'
  images?: Image[] | null
  meta?: Record<string, any> | null

  isPublished: boolean
  hasPassword: boolean
  publicAt?: string | Date | null

  mood?: string | null
  weather?: string | null
  bookmark: boolean

  coordinates?: Coordinate | null
  location?: string | null

  readCount: number
  likeCount: number

  topicId?: string | null
  topic?: TopicModel | null

  createdAt: string
  modifiedAt: string | null

  /**
   * Server-injected only when the list endpoint is called with
   * `?withSummary=1`. Falls back to the first 150 chars of `text` if the AI
   * summary cache misses. Absent on detail endpoints.
   */
  summary?: string

  /**
   * Server-injected only on detail endpoints. Bulk pre-resolved enrichments
   * for URLs found in the body. Frontend renders link cards inline without
   * extra fetches when present; cache misses fall through to
   * `/enrichment/resolve`.
   */
  enrichments?: NoteEnrichmentMap
}

export interface Coordinate {
  latitude: number
  longitude: number
}

export interface NoteWrappedPayload {
  data: NoteModel
  next?: Partial<NoteModel>
  prev?: Partial<NoteModel>
}

export interface NoteWrappedWithLikedPayload {
  data: ModelWithLiked<NoteModel>
  next?: Partial<NoteModel>
  prev?: Partial<NoteModel>
}

export interface NoteWrappedWithLikedAndTranslationPayload {
  data: ModelWithLiked<ModelWithTranslation<NoteModel>>
  next?: Partial<NoteModel>
  prev?: Partial<NoteModel>
}
