import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

/**
 * Analyze schema
 */
export const AnalyzeSchema = z.object({
  from: z
    .preprocess(
      (val) =>
        typeof val === 'string' ? new Date(Number.parseInt(val, 10)) : val,
      z.date(),
    )
    .optional(),
  to: z
    .preprocess(
      (val) =>
        typeof val === 'string' ? new Date(Number.parseInt(val, 10)) : val,
      z.date(),
    )
    .optional(),
})

export class AnalyzeDto extends createZodDto(AnalyzeSchema) {}

// Type exports
export type AnalyzeInput = z.infer<typeof AnalyzeSchema>
