import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import { normalizeLanguageCode } from '~/utils/lang.util'

const MAX_TASK_LANGS = 8

const zResolvableLang = z
  .string()
  .refine((lang) => normalizeLanguageCode(lang) !== undefined, {
    message: 'unresolvable language code',
  })

export const CreateTtsTaskSchema = z.object({
  refId: z.string(),
  langs: z.array(zResolvableLang).max(MAX_TASK_LANGS).optional(),
  force: z.boolean().optional(),
})
export class CreateTtsTaskDto extends createZodDto(CreateTtsTaskSchema) {}

export const GetTtsQuerySchema = z.object({
  lang: z.string().optional(),
  password: z.string().optional(),
})
export class GetTtsQueryDto extends createZodDto(GetTtsQuerySchema) {}

export type CreateTtsTaskInput = z.infer<typeof CreateTtsTaskSchema>
export type GetTtsQueryInput = z.infer<typeof GetTtsQuerySchema>
