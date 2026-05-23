import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const BackfillSchema = z.object({
  sourceTypes: z.array(z.enum(['post', 'note', 'page'])).optional(),
})

export class BackfillDto extends createZodDto(BackfillSchema) {}

export type BackfillInput = z.infer<typeof BackfillSchema>
