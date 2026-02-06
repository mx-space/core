import {
  zCoerceInt,
  zMongoId,
  zPaginationPage,
  zPaginationSize,
  zSortOrder,
} from '~/common/zod'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

const DbQuerySchema = z.object({
  db_query: z.any().optional(),
})

export const PagerSchema = DbQuerySchema.extend({
  size: zPaginationSize,
  page: zPaginationPage,
  select: z.string().min(1).optional(),
  sortBy: z.string().optional(),
  sortOrder: zSortOrder,
  year: zCoerceInt.min(1).optional(),
  state: zCoerceInt.optional(),
})

export class PagerDto extends createZodDto(PagerSchema) {}

export const OffsetSchema = z.object({
  before: zMongoId.optional(),
  after: zMongoId.optional(),
  size: zCoerceInt.max(50).optional(),
})

export class OffsetDto extends createZodDto(OffsetSchema) {}

export type PagerInput = z.infer<typeof PagerSchema>
export type OffsetInput = z.infer<typeof OffsetSchema>
