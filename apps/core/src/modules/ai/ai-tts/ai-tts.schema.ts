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
export type CreateTtsTaskDto = z.infer<typeof CreateTtsTaskSchema>

export const GetTtsQuerySchema = z.object({
  lang: z.string().optional(),
  password: z.string().optional(),
})
export type GetTtsQueryDto = z.infer<typeof GetTtsQuerySchema>

export const GetTtsGroupedQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().optional(),
})
export type GetTtsGroupedQueryDto = z.infer<typeof GetTtsGroupedQuerySchema>

export const DiscoverTtsVoicesQuerySchema = z.object({
  providerId: z.string().trim().min(1, 'providerId is required'),
  model: z.string().trim().min(1, 'model is required'),
})
export type DiscoverTtsVoicesQueryDto = z.infer<
  typeof DiscoverTtsVoicesQuerySchema
>

export type CreateTtsTaskInput = z.infer<typeof CreateTtsTaskSchema>
export type GetTtsQueryInput = z.infer<typeof GetTtsQuerySchema>
export type GetTtsGroupedQueryInput = z.infer<typeof GetTtsGroupedQuerySchema>
export type DiscoverTtsVoicesQueryInput = z.infer<
  typeof DiscoverTtsVoicesQuerySchema
>
