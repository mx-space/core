import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const PersonaKeyParamSchema = z.object({
  key: z.string().min(1).max(64),
})

export class PersonaKeyParamDto extends createZodDto(PersonaKeyParamSchema) {}

export const DistillOutputSchema = z.object({
  profile: z.string().min(1),
  profile_summary: z.string().nullish(),
  metadata: z
    .object({
      tone_tags: z.array(z.string()).default([]),
      recurring_themes: z.array(z.string()).default([]),
      signature_phrases: z.array(z.string()).default([]),
    })
    .partial()
    .default({}),
})

export type DistillOutputInput = z.infer<typeof DistillOutputSchema>
