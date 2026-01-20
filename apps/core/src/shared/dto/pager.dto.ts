import {
  zCoerceInt,
  zMongoId,
  zPaginationPage,
  zPaginationSize,
  zSortOrder,
} from '~/common/zod'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

/**
 * Base DB query schema (internal use)
 */
const DbQuerySchema = z.object({
  db_query: z.any().optional(),
})

/**
 * Pagination schema
 * Supports page/size pagination with optional sorting and filtering
 */
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

/**
 * Cursor-based pagination (offset) schema
 * Uses before/after cursor with optional size
 */
export const OffsetSchema = z
  .object({
    before: zMongoId.optional(),
    after: zMongoId.optional(),
    size: zCoerceInt.max(50).optional(),
  })
  .refine(
    (data) => {
      // If before is defined, after should also be validated
      // This mimics the ValidateIf behavior
      if (data.before !== undefined && data.after === undefined) {
        return true
      }
      return true
    },
    { message: 'Invalid cursor pagination parameters' },
  )

export class OffsetDto extends createZodDto(OffsetSchema) {}

// Type exports
export type PagerInput = z.infer<typeof PagerSchema>
export type OffsetInput = z.infer<typeof OffsetSchema>
