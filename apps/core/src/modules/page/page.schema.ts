import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import { zCoerceInt, zEntityId, zNonEmptyString, zPrefer } from '~/common/zod'
import { WriteBaseSchema } from '~/shared/schema'
import { ImageSchema } from '~/shared/schema/image.schema'
import { ContentFormat } from '~/shared/types/content-format.type'

/**
 * Page schema for API validation
 */
export const PageSchema = WriteBaseSchema.extend({
  slug: zNonEmptyString,
  subtitle: z.string().nullable().optional(),
  order: z.preprocess(
    (val) =>
      typeof val === 'string' ? Number.parseInt(val, 10) : (val as number),
    z.number().int().min(0).default(1),
  ),
  images: z.array(ImageSchema).optional(),
  /** 关联的草稿 ID，发布时标记该草稿为已发布 */
  draftId: zEntityId.optional(),
})

export class PageDto extends createZodDto(PageSchema) {}

/**
 * Partial page schema for PATCH operations
 * Override fields with .default() to prevent defaults from being applied during partial updates
 */
export const PartialPageSchema = PageSchema.extend({
  contentFormat: z
    .enum([ContentFormat.Markdown, ContentFormat.Lexical])
    .optional(),
  meta: z.record(z.string(), z.any()).optional().nullable(),
  order: z.preprocess(
    (val) =>
      typeof val === 'string' ? Number.parseInt(val, 10) : (val as number),
    z.number().int().min(0).optional(),
  ),
}).partial()

export class PartialPageDto extends createZodDto(PartialPageSchema) {}

/**
 * Page reorder sequence item schema
 */
export const PageReorderSeqSchema = z.object({
  id: zEntityId,
  order: zCoerceInt.min(1),
})

/**
 * Page reorder schema
 */
export const PageReorderSchema = z.object({
  seq: z.array(PageReorderSeqSchema),
})

export class PageReorderDto extends createZodDto(PageReorderSchema) {}

/**
 * Page detail query schema
 */
export const PageDetailQuerySchema = z.object({
  prefer: zPrefer,
})

export class PageDetailQueryDto extends createZodDto(PageDetailQuerySchema) {}

// Type exports
export type PageInput = z.infer<typeof PageSchema>
export type PartialPageInput = z.infer<typeof PartialPageSchema>
export type PageReorderSeqInput = z.infer<typeof PageReorderSeqSchema>
export type PageReorderInput = z.infer<typeof PageReorderSchema>
