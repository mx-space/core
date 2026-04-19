import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import { zCoerceBoolean } from '~/common/zod'

export const BaseLangQuerySchema = z.object({
  lang: z.string().optional(),
})

export const GetInsightsQuerySchema = BaseLangQuerySchema.extend({
  onlyDb: zCoerceBoolean.optional(),
})
export class GetInsightsQueryDto extends createZodDto(GetInsightsQuerySchema) {}

export const GetInsightsStreamQuerySchema = BaseLangQuerySchema.extend({})
export class GetInsightsStreamQueryDto extends createZodDto(
  GetInsightsStreamQuerySchema,
) {}

export const UpdateInsightsSchema = z.object({
  content: z.string(),
})
export class UpdateInsightsDto extends createZodDto(UpdateInsightsSchema) {}

export const CreateInsightsTaskSchema = z.object({
  refId: z.string(),
})
export class CreateInsightsTaskDto extends createZodDto(
  CreateInsightsTaskSchema,
) {}

export const CreateInsightsTranslationTaskSchema = z.object({
  refId: z.string(),
  targetLang: z.string(),
})
export class CreateInsightsTranslationTaskDto extends createZodDto(
  CreateInsightsTranslationTaskSchema,
) {}

export const GetInsightsGroupedQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().optional(),
})
export class GetInsightsGroupedQueryDto extends createZodDto(
  GetInsightsGroupedQuerySchema,
) {}

// Type exports
export type GetInsightsQueryInput = z.infer<typeof GetInsightsQuerySchema>
export type UpdateInsightsInput = z.infer<typeof UpdateInsightsSchema>
export type GetInsightsGroupedQueryInput = z.infer<
  typeof GetInsightsGroupedQuerySchema
>
