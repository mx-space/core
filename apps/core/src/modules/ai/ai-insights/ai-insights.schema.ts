import { z } from 'zod'

import { zCoerceBoolean } from '~/common/zod'

import { MAX_LANGS_PER_TASK } from '../ai.constants'

export const BaseLangQuerySchema = z.object({
  lang: z.string().optional(),
})

export const GetInsightsQuerySchema = BaseLangQuerySchema.extend({
  onlyDb: zCoerceBoolean.optional(),
})
export type GetInsightsQueryDto = z.infer<typeof GetInsightsQuerySchema>

export const GetInsightsStreamQuerySchema = BaseLangQuerySchema.extend({})
export type GetInsightsStreamQueryDto = z.infer<
  typeof GetInsightsStreamQuerySchema
>

export const UpdateInsightsSchema = z.object({
  content: z.string(),
})
export type UpdateInsightsDto = z.infer<typeof UpdateInsightsSchema>

export const CreateInsightsTaskSchema = z.object({
  refId: z.string(),
  force: z.boolean().optional(),
  targetLanguages: z
    .array(z.string().trim().min(1))
    .max(MAX_LANGS_PER_TASK)
    .optional(),
})
export type CreateInsightsTaskDto = z.infer<typeof CreateInsightsTaskSchema>

export const CreateInsightsTranslationTaskSchema = z.object({
  refId: z.string(),
  targetLang: z.string(),
  force: z.boolean().optional(),
})
export type CreateInsightsTranslationTaskDto = z.infer<
  typeof CreateInsightsTranslationTaskSchema
>

export const GetInsightsGroupedQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().optional(),
})
export type GetInsightsGroupedQueryDto = z.infer<
  typeof GetInsightsGroupedQuerySchema
>

// Type exports
export type GetInsightsQueryInput = z.infer<typeof GetInsightsQuerySchema>
export type UpdateInsightsInput = z.infer<typeof UpdateInsightsSchema>
export type GetInsightsGroupedQueryInput = z.infer<
  typeof GetInsightsGroupedQuerySchema
>
