import { zNonEmptyString } from '~/common/zod'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

/**
 * Serverless reference schema
 */
export const ServerlessReferenceSchema = z.object({
  reference: zNonEmptyString,
  name: zNonEmptyString,
})

export class ServerlessReferenceDto extends createZodDto(
  ServerlessReferenceSchema,
) {}

// Type exports
export type ServerlessReferenceInput = z.infer<typeof ServerlessReferenceSchema>
