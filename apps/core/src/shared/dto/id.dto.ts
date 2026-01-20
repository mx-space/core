import { UnprocessableEntityException } from '@nestjs/common'
import { zMongoId } from '~/common/zod'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

/**
 * MongoDB ObjectId validation schema
 */
export const MongoIdSchema = z.object({
  id: zMongoId,
})

export class MongoIdDto extends createZodDto(MongoIdSchema) {}

/**
 * Int or MongoId validation schema
 * Accepts either a valid MongoDB ObjectId string or a positive integer
 */
export const IntIdOrMongoIdSchema = z.object({
  id: z.preprocess(
    (value) => {
      if (typeof value === 'string') {
        // Check if it's a valid MongoId
        if (/^[0-9a-f]{24}$/i.test(value)) {
          return value
        }
        // Try to parse as number
        const nid = Number(value)
        if (!Number.isNaN(nid) && Number.isInteger(nid) && nid > 0) {
          return nid
        }
      }
      if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
        return value
      }
      throw new UnprocessableEntityException('Invalid id')
    },
    z.union([zMongoId, z.number().int().positive()]),
  ),
})

export class IntIdOrMongoIdDto extends createZodDto(IntIdOrMongoIdSchema) {}

// Type exports
export type MongoIdInput = z.infer<typeof MongoIdSchema>
export type IntIdOrMongoIdInput = z.infer<typeof IntIdOrMongoIdSchema>
