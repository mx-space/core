import { z } from 'zod'

export const GetTranslationQuerySchema = z.object({
  lang: z.string(),
})

export type GetTranslationQueryDto = z.infer<typeof GetTranslationQuerySchema>

export const GetTranslationStreamQuerySchema = z.object({
  lang: z.string(),
})

export type GetTranslationStreamQueryDto = z.infer<
  typeof GetTranslationStreamQuerySchema
>

export const UpdateTranslationSchema = z.object({
  title: z.string().optional(),
  text: z.string().optional(),
  subtitle: z.string().nullable().optional(),
  summary: z.string().optional(),
  tags: z.array(z.string()).optional(),
  content: z
    .string()
    .nullish()
    .transform((content) => content ?? undefined),
})

export type UpdateTranslationDto = z.infer<typeof UpdateTranslationSchema>

export const GetTranslationsGroupedQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().optional(),
})

export type GetTranslationsGroupedQueryDto = z.infer<
  typeof GetTranslationsGroupedQuerySchema
>

export type GetTranslationsGroupedQueryInput = z.infer<
  typeof GetTranslationsGroupedQuerySchema
>
