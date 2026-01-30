import {
  zArrayUnique,
  zCoerceInt,
  zMongoId,
  zNonEmptyString,
  zPinDate,
} from '~/common/zod'
import { PagerSchema } from '~/shared/dto/pager.dto'
import { WriteBaseSchema } from '~/shared/schema'
import { ImageSchema } from '~/shared/schema/image.schema'
import { normalizeLanguageCode } from '~/utils/lang.util'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

/**
 * Post schema for API validation
 */
export const PostSchema = WriteBaseSchema.extend({
  slug: zNonEmptyString,
  summary: z
    .preprocess((val) => (val === '' ? null : val), z.string().nullable())
    .optional(),
  categoryId: zMongoId,
  copyright: z.boolean().default(true).optional(),
  isPublished: z.boolean().default(true).optional(),
  tags: zArrayUnique(z.string().min(1)).optional(),
  pin: zPinDate,
  pinOrder: z.preprocess(
    (val) => (val === null ? undefined : val),
    zCoerceInt.min(0).optional(),
  ),
  relatedId: z.array(zMongoId).optional(),
  images: z.array(ImageSchema).optional(),
  /** 关联的草稿 ID，发布时标记该草稿为已发布 */
  draftId: zMongoId.optional(),
})

export class PostDto extends createZodDto(PostSchema) {}

/**
 * Partial post schema for PATCH operations
 */
export const PartialPostSchema = PostSchema.partial()

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
  lang: z
    .preprocess(
      (val) => normalizeLanguageCode(val as string),
      z.string().length(2),
    )
    .optional(),
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
      z.array(zMongoId),
    )
    .optional(),
  lang: z
    .preprocess(
      (val) => normalizeLanguageCode(val as string),
      z.string().length(2),
    )
    .optional(),
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
