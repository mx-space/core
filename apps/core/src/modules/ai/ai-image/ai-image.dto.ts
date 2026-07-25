import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const DraftImagePromptSchema = z
  .object({
    presetId: z.string().min(1),
    refId: z.string().optional(),
    title: z.string().optional(),
    summary: z.string().optional(),
  })
  .refine((data) => !!data.refId || (!!data.title && !!data.summary), {
    message: 'Either refId or both title and summary are required',
  })

export class DraftImagePromptDto extends createZodDto(DraftImagePromptSchema) {}

export const GenerateImageSchema = z
  .object({
    prompt: z.string().min(1).optional(),
    presetId: z.string().optional(),
    aspectRatio: z
      .enum(['1:1', '3:2', '2:3', '4:3', '3:4', '16:9', '9:16'])
      .optional(),
    quality: z.enum(['low', 'standard', 'high']).optional(),
    format: z.enum(['png', 'jpeg', 'webp']).optional(),
    model: z.string().optional(),
    providerParams: z.record(z.string(), z.unknown()).optional(),
    purpose: z.enum(['cover', 'inline']),
    refId: z.string().optional(),
    requestId: z.string().min(1),
  })
  .refine((data) => !!data.prompt || (!!data.presetId && !!data.refId), {
    message: 'Either prompt, or presetId with refId, is required',
  })

export class GenerateImageDto extends createZodDto(GenerateImageSchema) {}

export type GenerateImageInput = z.infer<typeof GenerateImageSchema>
