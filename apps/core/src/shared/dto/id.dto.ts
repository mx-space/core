import { UnprocessableEntityException } from '@nestjs/common'
import { zMongoId } from '~/common/zod'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const MongoIdSchema = z.object({
  id: zMongoId,
})

export class MongoIdDto extends createZodDto(MongoIdSchema) {}

export const StringIdSchema = z.object({
  id: z.string(),
})

export class StringIdDto extends createZodDto(StringIdSchema) {}

export const IntIdOrMongoIdSchema = z.object({
  id: z.preprocess(
    (value) => {
      if (typeof value === 'string') {
        if (/^[0-9a-f]{24}$/i.test(value)) {
          return value
        }
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

export type MongoIdInput = z.infer<typeof MongoIdSchema>
export type IntIdOrMongoIdInput = z.infer<typeof IntIdOrMongoIdSchema>
