export interface Image {
  height: number
  width: number
  type: string
  accent?: string
  src: string
  blurHash?: string
}

export interface Pager {
  total: number
  size: number
  currentPage: number
  totalPage: number
  hasPrevPage: boolean
  hasNextPage: boolean
}

export interface PaginateResult<T> {
  data: T[]
  pagination: Pager
}

export type ModelWithLiked<T> = T & {
  liked: boolean
}

export interface TranslationMeta {
  sourceLang: string
  targetLang: string
  translatedAt: string
}

export type ModelWithTranslation<T> = T & {
  isTranslated: boolean
  translationMeta?: TranslationMeta
  availableTranslations?: string[]
  /**
   * Whether AI insights are available in the caller's requested locale.
   * Independent from `translationMeta` because insights maintain their own
   * translation pipeline — the article may be translated without insights,
   * and vice versa. Absent (undefined) on endpoints that don't surface it.
   */
  hasInsightsInLocale?: boolean
}
