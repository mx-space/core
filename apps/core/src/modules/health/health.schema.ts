import { zCoerceInt } from '~/common/zod'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

/**
 * Log query schema
 */
export const LogQuerySchema = z.object({
  type: z.enum(['out', 'error']).optional(),
  index: zCoerceInt.min(0).optional(),
  filename: z.string().optional(),
})

export class LogQueryDto extends createZodDto(LogQuerySchema) {}

/**
 * Log type schema
 */
export const LogTypeSchema = z.object({
  type: z.enum(['pm2', 'native']),
})

export class LogTypeDto extends createZodDto(LogTypeSchema) {}

// Type exports
export type LogQueryInput = z.infer<typeof LogQuerySchema>
export type LogTypeInput = z.infer<typeof LogTypeSchema>
