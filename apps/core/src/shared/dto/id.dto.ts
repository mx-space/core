import { UnprocessableEntityException } from '@nestjs/common'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import { zEntityId } from '~/common/zod'
import { isEntityIdString } from '~/shared/id/entity-id'

export const EntityIdSchema = z.object({
  id: zEntityId,
})

export class EntityIdDto extends createZodDto(EntityIdSchema) {}

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

export type EntityIdInput = z.infer<typeof EntityIdSchema>
export type IntIdOrEntityIdInput = z.infer<typeof IntIdOrEntityIdSchema>
