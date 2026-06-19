import type { EnrichmentResult } from './enrichment'

export interface Image {
  height: number
  width: number
  type: string
  accent?: string
  src: string
  thumbhash?: string
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

export interface SkillAssetView {
  path: string
  rawUrl: string
  type: string
  size: number
}

export interface SkillBundleView {
  id: string
  name: string
  description: string
  rawUrl: string
  assets: SkillAssetView[]
}

export interface BaseResponseMeta {
  pagination?: PaginationMeta
  view?: string
  translation?: EntryTranslation | Record<string, EntryTranslation>
  interaction?: InteractionMeta | Record<string, InteractionMeta>
  enrichments?: Record<string, EnrichmentResult>
}

export interface PostResponseMeta extends BaseResponseMeta {
  insights?: InsightsMeta
  related?: RelatedRef[]
  articles?: Record<string, RelatedRef>
  summary?: SummaryMeta
  skills?: SkillBundleView[]
}

export interface NoteResponseMeta extends BaseResponseMeta {
  insights?: InsightsMeta
  summary?: SummaryMeta
}

/**
 * @deprecated Use `BaseResponseMeta`, `PostResponseMeta`, or
 * `NoteResponseMeta` from `@mx-space/api-client` instead.
 */
export interface ResponseMeta extends BaseResponseMeta {
  related?: RelatedRef[]
  articles?: Record<string, RelatedRef>
  insights?: InsightsMeta
  summary?: SummaryMeta
  skills?: SkillBundleView[]
}
