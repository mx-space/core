import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import { zCoerceInt, zEntityId, zSortOrder } from '~/common/zod'

/**
 * Base pager — page + size + optional view. No sort fields.
 *
 * Use this when an endpoint does not expose sortable columns.
 * If sorting is supported, use {@link createPagerSchema} instead so the sort
 * keys are explicit and type-safe.
 */
export const BasicPagerSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  size: z.coerce.number().int().positive().max(100).default(10),
  view: z.string().optional(),
})

export class BasicPagerDto extends createZodDto(BasicPagerSchema) {}

export type BasicPagerInput = z.infer<typeof BasicPagerSchema>

/**
 * Sort-aware pager factory. Pass the column names this endpoint is allowed to
 * sort by; the resulting schema exposes `sortBy` (typed as `z.enum(sortKeys)`)
 * and `sortOrder` (`'asc' | 'desc'`, default `'desc'`) inside core. On the
 * wire both `sortBy=`/`sort_by=` are accepted (the global request-case
 * normalization pipe folds snake_case query keys to camelCase before zod), and
 * the legacy `1` / `-1` sortOrder values are coerced to `'asc'` / `'desc'`.
 */
export const createPagerSchema = <TSort extends [string, ...string[]]>(
  sortKeys: TSort,
) =>
  BasicPagerSchema.extend({
    sortBy: z.enum(sortKeys).optional(),
    sortOrder: zSortOrder,
    year: z.coerce.number().int().optional(),
  })

export const OffsetSchema = z.object({
  before: zEntityId.optional(),
  after: zEntityId.optional(),
  size: zCoerceInt.max(50).optional(),
})

export class OffsetDto extends createZodDto(OffsetSchema) {}

export type OffsetInput = z.infer<typeof OffsetSchema>
