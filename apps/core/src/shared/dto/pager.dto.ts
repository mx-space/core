import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import {
  zCoerceInt,
  zEntityId,
  zPaginationPage,
  zPaginationSize,
  zSortOrder,
} from '~/common/zod'

const DbQuerySchema = z.object({
  db_query: z.any().optional(),
})

/** @deprecated V2 endpoints use {@link createPagerSchema} instead. */
export const PagerSchema = DbQuerySchema.extend({
  size: zPaginationSize,
  page: zPaginationPage,
  select: z.string().min(1).optional(),
  sortBy: z.string().optional(),
  sortOrder: zSortOrder,
  year: zCoerceInt.min(1).optional(),
  state: zCoerceInt.optional(),
})

/** @deprecated V2 endpoints use {@link createPagerSchema} instead. */
export class PagerDto extends createZodDto(PagerSchema) {}

export const createPagerSchema = <TSort extends [string, ...string[]]>(
  sortKeys: TSort,
) =>
  z.object({
    page: z.coerce.number().int().positive().default(1),
    size: z.coerce.number().int().positive().max(100).default(10),
    view: z.string().optional(),
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

export type PagerInput = z.infer<typeof PagerSchema>
export type OffsetInput = z.infer<typeof OffsetSchema>
