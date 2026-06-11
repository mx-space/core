import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import { BasicPagerSchema } from '~/shared/dto/pager.dto'

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

/**
 * Analyze schema with a capped pager (size ≤ 100) so caller-supplied
 * `page`/`size` are runtime-validated rather than reaching the service raw.
 * Keeps the legacy default size of 50 for analyze endpoints.
 */
export const AnalyzePagerSchema = AnalyzeSchema.merge(BasicPagerSchema).extend({
  size: BasicPagerSchema.shape.size.default(50),
})

export class AnalyzePagerDto extends createZodDto(AnalyzePagerSchema) {}

// Type exports
export type AnalyzeInput = z.infer<typeof AnalyzeSchema>
export type AnalyzePagerInput = z.infer<typeof AnalyzePagerSchema>
