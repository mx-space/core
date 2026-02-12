import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const GetTranslationQuerySchema = z.object({
  lang: z.string(),
})

export class GetTranslationQueryDto extends createZodDto(
  GetTranslationQuerySchema,
) {}

export const GetTranslationStreamQuerySchema = z.object({
  lang: z.string(),
})

export class GetTranslationStreamQueryDto extends createZodDto(
  GetTranslationStreamQuerySchema,
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

export const GetTranslationsGroupedQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().optional(),
})

export class GetTranslationsGroupedQueryDto extends createZodDto(
  GetTranslationsGroupedQuerySchema,
) {}

export type GetTranslationQueryInput = z.infer<typeof GetTranslationQuerySchema>
export type UpdateTranslationInput = z.infer<typeof UpdateTranslationSchema>
export type GetTranslationsGroupedQueryInput = z.infer<
  typeof GetTranslationsGroupedQuerySchema
>
