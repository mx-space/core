import { UnprocessableEntityException } from '@nestjs/common'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import { zEntityId, zMongoId } from '~/common/zod'
import { isEntityIdString } from '~/shared/id/entity-id'

export const EntityIdSchema = z.object({
  id: zEntityId,
})

export class EntityIdDto extends createZodDto(EntityIdSchema) {}

/**
 * @deprecated MongoDB-only DTO retained for migration tooling and historical
 * references. Use {@link EntityIdDto} for runtime routes.
 */
export const MongoIdSchema = z.object({
  id: zMongoId,
})

/** @deprecated See {@link EntityIdDto}. */
export class MongoIdDto extends createZodDto(MongoIdSchema) {}

export const StringIdSchema = z.object({
  id: z.string(),
})

export class StringIdDto extends createZodDto(StringIdSchema) {}

export const IntIdOrEntityIdSchema = z.object({
  id: z.preprocess(
    (value) => {
      if (typeof value === 'string') {
        if (isEntityIdString(value)) {
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
    z.union([zEntityId, z.number().int().positive()]),
  ),
})

export class IntIdOrEntityIdDto extends createZodDto(IntIdOrEntityIdSchema) {}

/**
 * @deprecated Use {@link IntIdOrEntityIdSchema}. Retained while migration code
 * still operates against historical Mongo ObjectId inputs.
 */
export const IntIdOrMongoIdSchema = z.object({
  id: z.preprocess(
    (value) => {
      if (typeof value === 'string') {
        if (/^[\da-f]{24}$/i.test(value)) {
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

/** @deprecated See {@link IntIdOrEntityIdDto}. */
export class IntIdOrMongoIdDto extends createZodDto(IntIdOrMongoIdSchema) {}

export type EntityIdInput = z.infer<typeof EntityIdSchema>
export type IntIdOrEntityIdInput = z.infer<typeof IntIdOrEntityIdSchema>
export type MongoIdInput = z.infer<typeof MongoIdSchema>
export type IntIdOrMongoIdInput = z.infer<typeof IntIdOrMongoIdSchema>
