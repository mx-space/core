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

export const GenerateImageSchema = z.object({
  prompt: z.string().min(1),
  presetId: z.string().optional(),
  aspectRatio: z
    .enum(['1:1', '3:2', '2:3', '4:3', '3:4', '16:9', '9:16'])
    .optional(),
  quality: z.enum(['low', 'standard', 'high']).optional(),
  format: z.enum(['png', 'jpeg', 'webp']).optional(),
  providerParams: z.record(z.string(), z.unknown()).optional(),
  purpose: z.enum(['cover', 'inline']),
  refId: z.string().optional(),
  requestId: z.string().min(1),
})

export class GenerateImageDto extends createZodDto(GenerateImageSchema) {}

export type GenerateImageInput = z.infer<typeof GenerateImageSchema>
