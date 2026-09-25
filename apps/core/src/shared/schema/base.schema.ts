import { z } from 'zod'

import { zCoerceDate } from '~/common/zod'

export const BaseSchema = z.object({
  created: zCoerceDate.optional(),
})

export const BaseCommentIndexSchema = BaseSchema.extend({
  allowComment: z.boolean().default(true).optional(),
})
