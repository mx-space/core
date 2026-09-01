import { z } from 'zod'

import { zNonEmptyString } from '~/common/zod'

export const ServerlessReferenceSchema = z.object({
  reference: zNonEmptyString,
  name: zNonEmptyString,
})

export type ServerlessReferenceDto = z.infer<typeof ServerlessReferenceSchema>

export const ServerlessLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['success', 'error']).optional(),
})

export type ServerlessLogQueryDto = z.infer<typeof ServerlessLogQuerySchema>

// Type exports
export type ServerlessReferenceInput = z.infer<typeof ServerlessReferenceSchema>
