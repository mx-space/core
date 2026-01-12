import { zNonEmptyString } from '~/common/zod'
import { PagerSchema } from '~/shared/dto/pager.dto'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

/**
 * Search schema
 */
export const SearchSchema = PagerSchema.extend({
  keyword: zNonEmptyString,
  orderBy: zNonEmptyString.optional(),
  order: z.preprocess(
    (val) => (typeof val === 'string' ? Number.parseInt(val, 10) : val),
    z.union([z.literal(1), z.literal(-1)]).optional(),
  ),
  rawAlgolia: z
    .preprocess(
      (val) => (val === 'true' || val === '1' ? 1 : 0),
      z.union([z.literal(0), z.literal(1)]),
    )
    .optional(),
})

export class SearchDto extends createZodDto(SearchSchema) {}

// Type exports
export type SearchInput = z.infer<typeof SearchSchema>
