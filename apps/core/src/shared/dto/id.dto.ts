import { UnprocessableEntityException } from '@nestjs/common'
import { z } from 'zod'

import { zEntityId } from '~/common/zod'
import { isEntityIdString } from '~/shared/id/entity-id'

export const EntityIdSchema = z.object({
  id: zEntityId,
})

export type EntityIdDto = z.infer<typeof EntityIdSchema>

export const StringIdSchema = z.object({
  id: z.string(),
})

export type StringIdDto = z.infer<typeof StringIdSchema>

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

export type IntIdOrEntityIdDto = z.infer<typeof IntIdOrEntityIdSchema>

export type EntityIdInput = z.infer<typeof EntityIdSchema>
export type IntIdOrEntityIdInput = z.infer<typeof IntIdOrEntityIdSchema>
