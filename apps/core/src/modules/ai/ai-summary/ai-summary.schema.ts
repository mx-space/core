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

export const GetSummaryStreamQuerySchema = BaseLangQuerySchema.extend({})

export class GetSummaryStreamQueryDto extends createZodDto(
  GetSummaryStreamQuerySchema,
) {}

/**
 * Update summary schema
 */
export const UpdateSummarySchema = z.object({
  summary: z.string(),
})

export class UpdateSummaryDto extends createZodDto(UpdateSummarySchema) {}

export const GetSummariesGroupedQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().optional(),
})

export class GetSummariesGroupedQueryDto extends createZodDto(
  GetSummariesGroupedQuerySchema,
) {}

// Type exports
export type BaseLangQueryInput = z.infer<typeof BaseLangQuerySchema>
export type GenerateAiSummaryInput = z.infer<typeof GenerateAiSummarySchema>
export type GetSummaryQueryInput = z.infer<typeof GetSummaryQuerySchema>
export type UpdateSummaryInput = z.infer<typeof UpdateSummarySchema>
export type GetSummariesGroupedQueryInput = z.infer<
  typeof GetSummariesGroupedQuerySchema
>
