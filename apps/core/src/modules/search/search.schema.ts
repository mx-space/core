import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import { zNonEmptyString } from '~/common/zod'
import { PagerSchema } from '~/shared/dto/pager.dto'

export const SearchSchema = PagerSchema.extend({
  keyword: zNonEmptyString,
  orderBy: zNonEmptyString.optional(),
  order: z.preprocess(
    (val) => (typeof val === 'string' ? Number.parseInt(val, 10) : val),
    z.union([z.literal(1), z.literal(-1)]).optional(),
  ),
})

export class SearchDto extends createZodDto(SearchSchema) {}

// Type exports
export type SearchInput = z.infer<typeof SearchSchema>
