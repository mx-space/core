import { zCoerceInt, zMongoId, zNonEmptyString } from '~/common/zod'
import { WriteBaseSchema } from '~/shared/schema'
import { ImageSchema } from '~/shared/schema/image.schema'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

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
  draftId: zMongoId.optional(),
})

export class PageDto extends createZodDto(PageSchema) {}

/**
 * Partial page schema for PATCH operations
 */
export const PartialPageSchema = PageSchema.partial()

export class PartialPageDto extends createZodDto(PartialPageSchema) {}

/**
 * Page reorder sequence item schema
 */
export const PageReorderSeqSchema = z.object({
  id: zMongoId,
  order: zCoerceInt.min(1),
})

/**
 * Page reorder schema
 */
export const PageReorderSchema = z.object({
  seq: z.array(PageReorderSeqSchema),
})

export class PageReorderDto extends createZodDto(PageReorderSchema) {}

// Type exports
export type PageInput = z.infer<typeof PageSchema>
export type PartialPageInput = z.infer<typeof PartialPageSchema>
export type PageReorderSeqInput = z.infer<typeof PageReorderSeqSchema>
export type PageReorderInput = z.infer<typeof PageReorderSchema>
