import { zCoerceDate } from '~/common/zod'
import { z } from 'zod'

export const BaseSchema = z.object({
  created: zCoerceDate.optional(),
})

export const BaseCommentIndexSchema = BaseSchema.extend({
  allowComment: z.boolean().default(true).optional(),
})

export type BaseInput = z.infer<typeof BaseSchema>
export type BaseCommentIndexInput = z.infer<typeof BaseCommentIndexSchema>
