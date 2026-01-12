import { zCoerceBoolean } from '~/common/zod'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

/**
 * Base lang query schema
 */
export const BaseLangQuerySchema = z.object({
  lang: z.string().optional(),
})

/**
 * Generate AI summary schema
 */
export const GenerateAiSummarySchema = BaseLangQuerySchema.extend({
  refId: z.string(),
})

export class GenerateAiSummaryDto extends createZodDto(
  GenerateAiSummarySchema,
) {}

/**
 * Get summary query schema
 */
export const GetSummaryQuerySchema = BaseLangQuerySchema.extend({
  onlyDb: zCoerceBoolean.optional(),
})

export class GetSummaryQueryDto extends createZodDto(GetSummaryQuerySchema) {}

/**
 * Update summary schema
 */
export const UpdateSummarySchema = z.object({
  summary: z.string(),
})

export class UpdateSummaryDto extends createZodDto(UpdateSummarySchema) {}

// Type exports
export type BaseLangQueryInput = z.infer<typeof BaseLangQuerySchema>
export type GenerateAiSummaryInput = z.infer<typeof GenerateAiSummarySchema>
export type GetSummaryQueryInput = z.infer<typeof GetSummaryQuerySchema>
export type UpdateSummaryInput = z.infer<typeof UpdateSummarySchema>
