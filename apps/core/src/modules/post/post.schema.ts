import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import {
  zArrayUnique,
  zCoerceInt,
  zEntityId,
  zLang,
  zNonEmptyString,
  zOptionalBoolean,
  zPinDate,
  zPrefer,
} from '~/common/zod'
import { MarkdownToLexicalMigrationDescriptorSchema } from '~/modules/content-migration/content-migration.schema'
import { createPagerSchema } from '~/shared/dto/pager.dto'
import {
  validateLexicalCreateContentPair,
  WriteBaseSchema,
} from '~/shared/schema'
import { ImageArraySchema } from '~/shared/schema/image.schema'

/**
 * Post schema for API validation
 */
const PostBaseSchema = WriteBaseSchema.extend({
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
  images: ImageArraySchema.optional(),
  isPremium: z.boolean().optional(),
  migration: MarkdownToLexicalMigrationDescriptorSchema.optional(),
})

export const PostSchema = PostBaseSchema.superRefine(
  validateLexicalCreateContentPair,
)

export class PostDto extends createZodDto(PostSchema) {}

/**
 * Partial post schema for PATCH operations
 * Override fields with .default() to prevent defaults from being applied during partial updates
 */
export const PartialPostSchema = z.object({
  categoryId: zEntityId.optional(),
  pinAt: zPinDate,
})

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
export const PostPagerSchema = createPagerSchema([
  'createdAt',
  'modifiedAt',
  'pinAt',
]).extend({
  truncate: zCoerceInt.optional(),
  categoryIds: z
    .preprocess(
      (val) => (typeof val === 'string' ? val.split(',') : val),
      z.array(zEntityId),
    )
    .optional(),
  excludeAiWritten: zOptionalBoolean,
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
