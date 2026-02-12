import { zCoerceBoolean, zMongoId, zNonEmptyString } from '~/common/zod'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { CategoryType } from './category.model'

/**
 * Category schema for API validation
 */
export const CategorySchema = z.object({
  name: zNonEmptyString,
  type: z.enum(CategoryType).default(CategoryType.Category).optional(),
  slug: zNonEmptyString.optional(),
})

export class CategoryDto extends createZodDto(CategorySchema) {}

/**
 * Partial category schema for PATCH operations
 */
export const PartialCategorySchema = CategorySchema.partial()

export class PartialCategoryDto extends createZodDto(PartialCategorySchema) {}

/**
 * Slug or ID query schema
 */
export const SlugOrIdSchema = z.object({
  query: zNonEmptyString.optional(),
})

export class SlugOrIdDto extends createZodDto(SlugOrIdSchema) {}

/**
 * Multi query tag and category schema
 */
export const MultiQueryTagAndCategorySchema = z.object({
  tag: z
    .preprocess(
      (val) => {
        if (val === '1' || val === 'true') return true
        return val
      },
      z.union([z.boolean(), z.string()]),
    )
    .optional(),
})

export class MultiQueryTagAndCategoryDto extends createZodDto(
  MultiQueryTagAndCategorySchema,
) {}

/**
 * Multi categories query schema
 */
export const MultiCategoriesQuerySchema = z.object({
  ids: z
    .preprocess(
      (val) => {
        if (typeof val === 'string') {
          return [...new Set(val.split(','))]
        }
        return val
      },
      z
        .array(zMongoId)
        .refine((arr) => arr.every((id) => /^[0-9a-f]{24}$/i.test(id)), {
          message: '多分类查询使用逗号分隔，应为 mongoID',
        }),
    )
    .optional(),
  joint: zCoerceBoolean.optional(),
  type: z
    .preprocess((val) => {
      if (typeof val !== 'string') return CategoryType.Category
      switch (val.toLowerCase()) {
        case 'category':
          return CategoryType.Category
        case 'tag':
          return CategoryType.Tag
        default:
          return Object.values(CategoryType).includes(+val)
            ? +val
            : CategoryType.Category
      }
    }, z.enum(CategoryType))
    .optional(),
})

export class MultiCategoriesQueryDto extends createZodDto(
  MultiCategoriesQuerySchema,
) {}

// Type exports
export type CategoryInput = z.infer<typeof CategorySchema>
export type PartialCategoryInput = z.infer<typeof PartialCategorySchema>
export type SlugOrIdInput = z.infer<typeof SlugOrIdSchema>
export type MultiQueryTagAndCategoryInput = z.infer<
  typeof MultiQueryTagAndCategorySchema
>
export type MultiCategoriesQueryInput = z.infer<
  typeof MultiCategoriesQuerySchema
>
