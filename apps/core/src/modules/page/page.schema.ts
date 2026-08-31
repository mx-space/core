import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import { zCoerceInt, zEntityId, zNonEmptyString, zPrefer } from '~/common/zod'
import { MarkdownToLexicalMigrationDescriptorSchema } from '~/modules/content-migration/content-migration.schema'
import {
  validateLexicalCreateContentPair,
  WriteBaseSchema,
} from '~/shared/schema'
import { ImageArraySchema } from '~/shared/schema/image.schema'

/**
 * Page schema for API validation
 */
const PageBaseSchema = WriteBaseSchema.extend({
  slug: zNonEmptyString,
  subtitle: z.string().nullable().optional(),
  order: z.preprocess(
    (val) =>
      typeof val === 'string' ? Number.parseInt(val, 10) : (val as number),
    z.number().int().min(0).default(1),
  ),
  images: ImageArraySchema.optional(),
  migration: MarkdownToLexicalMigrationDescriptorSchema.optional(),
})

export const PageSchema = PageBaseSchema.superRefine(
  validateLexicalCreateContentPair,
)

export class PageDto extends createZodDto(PageSchema) {}

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
export type PageReorderSeqInput = z.infer<typeof PageReorderSeqSchema>
export type PageReorderInput = z.infer<typeof PageReorderSchema>
