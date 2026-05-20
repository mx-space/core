import type {
  ArticleRefMap,
  EnrichmentEntry,
  EntryTranslation,
  InsightsMeta,
  InteractionMeta,
  RelatedRef,
  ResponseMeta,
} from './meta.types'
import { ResponseMetaSchema } from './meta.types'

type LegacyPaginationLike = {
  currentPage?: number
  page?: number
  size: number
  total: number
  totalPage?: number
  total_pages?: number
  hasNextPage?: boolean
  hasPrevPage?: boolean
}

const normalizePagination = (pagination: LegacyPaginationLike) => {
  const page = pagination.page ?? pagination.currentPage ?? 1
  const totalPages =
    pagination.total_pages ??
    pagination.totalPage ??
    Math.ceil(pagination.total / pagination.size)

  return {
    page,
    size: pagination.size,
    total: pagination.total,
    total_pages: totalPages,
  }
}

export class MetaObjectBuilder {
  private readonly meta: Partial<ResponseMeta> = {}

  pagination(value: LegacyPaginationLike): this {
    this.meta.pagination = normalizePagination(value)
    return this
  }

  view(name: string): this {
    this.meta.view = name
    return this
  }

  translation(value: EntryTranslation | Map<string, EntryTranslation>): this {
    this.meta.translation =
      value instanceof Map ? Object.fromEntries(value) : value
    return this
  }

  interaction(value: InteractionMeta | Map<string, InteractionMeta>): this {
    this.meta.interaction =
      value instanceof Map ? Object.fromEntries(value) : value
    return this
  }

  enrichments(value: Record<string, EnrichmentEntry>): this {
    this.meta.enrichments = value
    return this
  }

  related(value: RelatedRef[]): this {
    this.meta.related = value
    return this
  }

  articles(value: ArticleRefMap): this {
    this.meta.articles = value
    return this
  }

  insights(value: InsightsMeta): this {
    this.meta.insights = value
    return this
  }

  build(): ResponseMeta {
    return ResponseMetaSchema.parse(this.meta)
  }
}
