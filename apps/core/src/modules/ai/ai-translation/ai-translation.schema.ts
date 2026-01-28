import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const GenerateTranslationSchema = z.object({
  refId: z.string(),
  targetLanguages: z.array(z.string()).optional(),
})

export class GenerateTranslationDto extends createZodDto(
  GenerateTranslationSchema,
) {}

export const GetTranslationQuerySchema = z.object({
  lang: z.string(),
})

export class GetTranslationQueryDto extends createZodDto(
  GetTranslationQuerySchema,
) {}

export const UpdateTranslationSchema = z.object({
  title: z.string().optional(),
  text: z.string().optional(),
  summary: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

export class UpdateTranslationDto extends createZodDto(
  UpdateTranslationSchema,
) {}

export const GenerateTranslationBatchSchema = z.object({
  refIds: z.array(z.string()).min(1).max(100),
  targetLanguages: z.array(z.string()).optional(),
})

export class GenerateTranslationBatchDto extends createZodDto(
  GenerateTranslationBatchSchema,
) {}

export const GenerateTranslationAllSchema = z.object({
  targetLanguages: z.array(z.string()).optional(),
})

export class GenerateTranslationAllDto extends createZodDto(
  GenerateTranslationAllSchema,
) {}

export const GetTranslationsGroupedQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().optional(),
})

export class GetTranslationsGroupedQueryDto extends createZodDto(
  GetTranslationsGroupedQuerySchema,
) {}

export type GenerateTranslationInput = z.infer<typeof GenerateTranslationSchema>
export type GetTranslationQueryInput = z.infer<typeof GetTranslationQuerySchema>
export type UpdateTranslationInput = z.infer<typeof UpdateTranslationSchema>
export type GenerateTranslationBatchInput = z.infer<
  typeof GenerateTranslationBatchSchema
>
export type GenerateTranslationAllInput = z.infer<
  typeof GenerateTranslationAllSchema
>
export type GetTranslationsGroupedQueryInput = z.infer<
  typeof GetTranslationsGroupedQuerySchema
>
