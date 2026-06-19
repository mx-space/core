import type { z } from 'zod'

import type {
  EnrichmentEntry,
  EntryTranslation,
  InteractionMeta,
} from './meta.types'
import { BaseResponseMetaSchema } from './meta.types'

type LegacyPaginationLike = {
  currentPage?: number
  page?: number
  size: number
  total: number
  totalPage?: number
  totalPages?: number
  hasNextPage?: boolean
  hasPrevPage?: boolean
}

const normalizePagination = (pagination: LegacyPaginationLike) => {
  const page = pagination.page ?? pagination.currentPage ?? 1
  const totalPages =
    pagination.totalPages ??
    pagination.totalPage ??
    Math.ceil(pagination.total / pagination.size)

  return {
    page,
    size: pagination.size,
    total: pagination.total,
    totalPages,
  }
}

export class MetaObjectBuilder<
  TSchema extends z.ZodTypeAny = typeof BaseResponseMetaSchema,
> {
  protected readonly meta: Partial<z.infer<TSchema>> = {}

  constructor(
    protected readonly schema: TSchema = BaseResponseMetaSchema as unknown as TSchema,
  ) {}

  pagination(value: LegacyPaginationLike): this {
    ;(this.meta as Record<string, unknown>).pagination =
      normalizePagination(value)
    return this
  }

  view(name: string): this {
    ;(this.meta as Record<string, unknown>).view = name
    return this
  }

  translation(value: EntryTranslation | Map<string, EntryTranslation>): this {
    ;(this.meta as Record<string, unknown>).translation =
      value instanceof Map ? Object.fromEntries(value) : value
    return this
  }

  interaction(value: InteractionMeta | Map<string, InteractionMeta>): this {
    ;(this.meta as Record<string, unknown>).interaction =
      value instanceof Map ? Object.fromEntries(value) : value
    return this
  }

  enrichments(value: Record<string, EnrichmentEntry>): this {
    ;(this.meta as Record<string, unknown>).enrichments = value
    return this
  }

  build(): z.infer<TSchema> {
    return this.schema.parse(this.meta) as z.infer<TSchema>
  }
}
