import { z } from 'zod'

export enum AiQueryType {
  TitleSlug = 'title-slug',
  Slug = 'slug',
}

/**
 * Generate AI schema
 */
export const GenerateAiSchema = z
  .object({
    type: z.enum(AiQueryType),
    text: z.string().optional(),
    title: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.type === AiQueryType.TitleSlug) {
        return !!data.text
      }
      if (data.type === AiQueryType.Slug) {
        return !!data.title
      }
      return true
    },
    {
      message:
        'text is required when type is TitleSlug, title is required when type is Slug',
    },
  )

export type GenerateAiDto = z.infer<typeof GenerateAiSchema>

// Type exports
export type GenerateAiInput = z.infer<typeof GenerateAiSchema>
