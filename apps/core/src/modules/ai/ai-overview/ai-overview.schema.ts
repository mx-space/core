import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import { CollectionRefTypes } from '~/constants/db.constant'

export const OVERVIEW_ARTICLE_TYPES = [
  CollectionRefTypes.Post,
  CollectionRefTypes.Note,
  CollectionRefTypes.Page,
] as const

export const GetOverviewGroupedQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().optional(),
  type: z.enum(OVERVIEW_ARTICLE_TYPES).optional(),
})

export class GetOverviewGroupedQueryDto extends createZodDto(
  GetOverviewGroupedQuerySchema,
) {}

export type GetOverviewGroupedQueryInput = z.infer<
  typeof GetOverviewGroupedQuerySchema
>
