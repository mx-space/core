import { zCoerceDate } from '~/common/zod'
import { z } from 'zod'

/**
 * Base schema - matches BaseModel from shared/model/base.model.ts
 *
 * Contains common fields for all models:
 * - created: timestamp
 * - id: MongoDB ObjectId as string
 */
export const BaseSchema = z.object({
  created: zCoerceDate.optional(),
})

/**
 * Base comment index schema - matches BaseCommentIndexModel
 *
 * Extends base with:
 * - allowComment: whether comments are allowed
 */
export const BaseCommentIndexSchema = BaseSchema.extend({
  allowComment: z.boolean().default(true).optional(),
})

export type BaseInput = z.infer<typeof BaseSchema>
export type BaseCommentIndexInput = z.infer<typeof BaseCommentIndexSchema>
