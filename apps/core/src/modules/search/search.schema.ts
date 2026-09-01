import { z } from 'zod'

import { zNonEmptyString } from '~/common/zod'
import { BasicPagerSchema } from '~/shared/dto/pager.dto'

const langField = z
  .string()
  .trim()
  .min(1)
  .transform((val) => val.toLowerCase())
  .optional()

export const SearchSchema = BasicPagerSchema.extend({
  keyword: zNonEmptyString,
  orderBy: zNonEmptyString.optional(),
  order: z.preprocess(
    (val) => (typeof val === 'string' ? Number.parseInt(val, 10) : val),
    z.union([z.literal(1), z.literal(-1)]).optional(),
  ),
  lang: langField,
})

export type SearchDto = z.infer<typeof SearchSchema>

export const SearchRebuildQuerySchema = z.object({
  force: z
    .preprocess(
      (val) =>
        typeof val === 'string'
          ? val.toLowerCase() === 'true' || val === '1'
          : val,
      z.boolean().optional(),
    )
    .optional(),
})

export type SearchRebuildQueryDto = z.infer<typeof SearchRebuildQuerySchema>

export const SearchRebuildRefParamSchema = z.object({
  refType: z.enum(['post', 'note', 'page']),
  refId: zNonEmptyString,
})

export type SearchRebuildRefParamDto = z.infer<
  typeof SearchRebuildRefParamSchema
>

export const SearchAdminListSchema = BasicPagerSchema.extend({
  refType: z.enum(['post', 'note', 'page']).optional(),
  lang: langField,
  keyword: z.string().trim().min(1).optional(),
})

export type SearchAdminListDto = z.infer<typeof SearchAdminListSchema>

// Type exports
export type SearchInput = z.infer<typeof SearchSchema>
export type SearchAdminListInput = z.infer<typeof SearchAdminListSchema>
