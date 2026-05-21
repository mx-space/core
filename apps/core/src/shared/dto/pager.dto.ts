import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import { zCoerceInt, zEntityId } from '~/common/zod'

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
 * sort by; the resulting schema exposes `sort_by` (typed as `z.enum(sortKeys)`)
 * and `sort_order` (`'asc' | 'desc'`, default `'desc'`) on the wire.
 */
export const createPagerSchema = <TSort extends [string, ...string[]]>(
  sortKeys: TSort,
) =>
  BasicPagerSchema.extend({
    sort_by: z.enum(sortKeys).optional(),
    sort_order: z.enum(['asc', 'desc']).default('desc'),
    year: z.coerce.number().int().optional(),
  })

export const OffsetSchema = z.object({
  before: zEntityId.optional(),
  after: zEntityId.optional(),
  size: zCoerceInt.max(50).optional(),
})

export class OffsetDto extends createZodDto(OffsetSchema) {}

export type OffsetInput = z.infer<typeof OffsetSchema>
