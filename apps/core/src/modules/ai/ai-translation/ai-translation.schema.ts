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

export type GenerateTranslationInput = z.infer<typeof GenerateTranslationSchema>
export type GetTranslationQueryInput = z.infer<typeof GetTranslationQuerySchema>
export type UpdateTranslationInput = z.infer<typeof UpdateTranslationSchema>
