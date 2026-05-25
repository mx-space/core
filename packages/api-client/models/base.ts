import type { EnrichmentResult } from './enrichment'

export interface Image {
  height: number
  width: number
  type: string
  accent?: string
  src: string
  blurHash?: string
}

export interface Pager {
  page: number
  size: number
  total: number
  totalPages: number
  hasNextPage?: boolean
  hasPrevPage?: boolean
}

export interface PaginateResult<T> {
  data: T[]
  pagination: Pager
}

export interface PaginationMeta {
  page: number
  size: number
  total: number
  totalPages: number
}

export interface InteractionMeta {
  isLiked?: boolean
  likeCount?: number
  readCount?: number
}

export interface ArticleTranslation {
  isTranslated: boolean
  sourceLang?: string
  targetLang?: string
  model?: string
  translatedAt?: string
  title?: string
  text?: string
  subtitle?: string | null
  summary?: string | null
  tags?: string[]
  content?: string
  contentFormat?: string
  availableTranslations?: string[]
}

export interface EntryTranslation {
  article?: ArticleTranslation
  fields?: Record<string, string>
}

export interface RelatedRef {
  id: string
  title: string
  slug?: string
  nid?: number
  type?: string
}

export interface InsightsMeta {
  hasInLocale: boolean
}

export interface SummaryMeta {
  id: string
  text: string
  lang: string
  createdAt: string
}

export interface ResponseMeta {
  pagination?: PaginationMeta
  view?: string
  translation?: EntryTranslation | Record<string, EntryTranslation>
  interaction?: InteractionMeta | Record<string, InteractionMeta>
  enrichments?: Record<string, EnrichmentResult>
  related?: RelatedRef[]
  articles?: Record<string, RelatedRef>
  insights?: InsightsMeta
  summary?: SummaryMeta
}
