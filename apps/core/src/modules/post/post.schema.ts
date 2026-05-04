import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import {
  zArrayUnique,
  zCoerceInt,
  zEntityId,
  zLang,
  zNonEmptyString,
  zPinDate,
  zPrefer,
} from '~/common/zod'
import { PagerSchema } from '~/shared/dto/pager.dto'
import { WriteBaseSchema } from '~/shared/schema'
import { ImageSchema } from '~/shared/schema/image.schema'
import { ContentFormat } from '~/shared/types/content-format.type'

/**
 * Post schema for API validation
 */
export const PostSchema = WriteBaseSchema.extend({
  slug: zNonEmptyString,
  summary: z
    .preprocess((val) => (val === '' ? null : val), z.string().nullable())
    .optional(),
  categoryId: zEntityId,
  copyright: z.boolean().default(true).optional(),
  isPublished: z.boolean().default(true).optional(),
  tags: zArrayUnique(z.string().min(1)).optional(),
  pin: zPinDate,
  pinOrder: z.preprocess(
    (val) => (val === null ? undefined : val),
    zCoerceInt.min(0).optional(),
  ),
  relatedId: z.array(zEntityId).optional(),
  images: z.array(ImageSchema).optional(),
  /** 关联的草稿 ID，发布时标记该草稿为已发布 */
  draftId: zEntityId.optional(),
})

export class PostDto extends createZodDto(PostSchema) {}

/**
 * Partial post schema for PATCH operations
 * Override fields with .default() to prevent defaults from being applied during partial updates
 */
export const PartialPostSchema = PostSchema.extend({
  contentFormat: z
    .enum([ContentFormat.Markdown, ContentFormat.Lexical])
    .optional(),
  meta: z.record(z.string(), z.any()).optional().nullable(),
  copyright: z.boolean().optional(),
  isPublished: z.boolean().optional(),
}).partial()

export class PartialPostDto extends createZodDto(PartialPostSchema) {}

/**
 * Category and slug params schema
 */
export const CategoryAndSlugSchema = z.object({
  category: z.string(),
  slug: z.preprocess((val) => {
    if (typeof val === 'string') {
      return decodeURI(val)
    }
    return val
  }, z.string()),
})

export class CategoryAndSlugDto extends createZodDto(CategoryAndSlugSchema) {}

/**
 * Post detail query schema
 */
export const PostDetailQuerySchema = z.object({
  lang: zLang,
  prefer: zPrefer,
})

export class PostDetailQueryDto extends createZodDto(PostDetailQuerySchema) {}

/**
 * Post pager schema
 */
export const PostPagerSchema = PagerSchema.extend({
  truncate: zCoerceInt.optional(),
  categoryIds: z
    .preprocess(
      (val) => (typeof val === 'string' ? val.split(',') : val),
      z.array(zEntityId),
    )
    .optional(),
  lang: zLang,
})

export class PostPagerDto extends createZodDto(PostPagerSchema) {}

/**
 * Set post publish status schema
 */
export const SetPostPublishStatusSchema = z.object({
  isPublished: z.boolean(),
})

export class SetPostPublishStatusDto extends createZodDto(
  SetPostPublishStatusSchema,
) {}

// Type exports
export type PostInput = z.infer<typeof PostSchema>
export type PartialPostInput = z.infer<typeof PartialPostSchema>
export type CategoryAndSlugInput = z.infer<typeof CategoryAndSlugSchema>
export type PostPagerInput = z.infer<typeof PostPagerSchema>
export type SetPostPublishStatusInput = z.infer<
  typeof SetPostPublishStatusSchema
>
