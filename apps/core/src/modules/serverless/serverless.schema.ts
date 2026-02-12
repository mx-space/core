import { zNonEmptyString } from '~/common/zod'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const ServerlessReferenceSchema = z.object({
  reference: zNonEmptyString,
  name: zNonEmptyString,
})

export class ServerlessReferenceDto extends createZodDto(
  ServerlessReferenceSchema,
) {}

export const ServerlessLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['success', 'error']).optional(),
})

export class ServerlessLogQueryDto extends createZodDto(
  ServerlessLogQuerySchema,
) {}

// Type exports
export type ServerlessReferenceInput = z.infer<typeof ServerlessReferenceSchema>
