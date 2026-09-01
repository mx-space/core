import { z } from 'zod'

import { zCoerceBoolean } from '~/common/zod'

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

export type GenerateAiSummaryDto = z.infer<typeof GenerateAiSummarySchema>

/**
 * Get summary query schema
 */
export const GetSummaryQuerySchema = BaseLangQuerySchema.extend({
  onlyDb: zCoerceBoolean.optional(),
})

export type GetSummaryQueryDto = z.infer<typeof GetSummaryQuerySchema>

export const GetSummaryStreamQuerySchema = BaseLangQuerySchema.extend({})

export type GetSummaryStreamQueryDto = z.infer<
  typeof GetSummaryStreamQuerySchema
>

/**
 * Update summary schema
 */
export const UpdateSummarySchema = z.object({
  summary: z.string(),
})

export type UpdateSummaryDto = z.infer<typeof UpdateSummarySchema>

export const GetSummariesGroupedQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().optional(),
})

export type GetSummariesGroupedQueryDto = z.infer<
  typeof GetSummariesGroupedQuerySchema
>

// Type exports
export type BaseLangQueryInput = z.infer<typeof BaseLangQuerySchema>
export type GenerateAiSummaryInput = z.infer<typeof GenerateAiSummarySchema>
export type GetSummaryQueryInput = z.infer<typeof GetSummaryQuerySchema>
export type UpdateSummaryInput = z.infer<typeof UpdateSummarySchema>
export type GetSummariesGroupedQueryInput = z.infer<
  typeof GetSummariesGroupedQuerySchema
>
