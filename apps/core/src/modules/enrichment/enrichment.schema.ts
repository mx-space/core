import { z } from 'zod'

export const ResolveQuerySchema = z.object({
  url: z.string().url(),
})
export type ResolveQueryDto = z.infer<typeof ResolveQuerySchema>

export const EnrichmentSearchParamsSchema = z.object({
  provider: z.string().trim().min(1).max(64),
})
export const EnrichmentSearchQuerySchema = z.object({
  query: z.string().trim().min(1).max(100),
  size: z.coerce.number().int().min(1).max(20).default(8),
})
export type EnrichmentSearchQueryDto = z.infer<
  typeof EnrichmentSearchQuerySchema
>

export const AdminListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
  onlyFailed: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) => v === true || v === 'true'),
  locale: z
    .string()
    .max(8)
    .optional()
    .transform((v) => (v === undefined ? undefined : v)),
})
export type AdminListQueryDto = z.infer<typeof AdminListQuerySchema>

export const AdminCaptureListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['last_accessed', 'created', 'bytes']).default('last_accessed'),
  order: z.enum(['asc', 'desc']).default('desc'),
})
export type AdminCaptureListQueryDto = z.infer<
  typeof AdminCaptureListQuerySchema
>

export const AdminProbeBodySchema = z.object({
  url: z.string().min(1),
  useCache: z.boolean().optional().default(false),
})
export type AdminProbeBodyDto = z.infer<typeof AdminProbeBodySchema>
