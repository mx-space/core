import { z } from 'zod'

import { zEntityId } from '~/common/zod'

export const ARTICLE_BODY_BATCH_LIMIT = 20

export const ArticleBodyItemSchema = z.object({
  bodyVersion: z.number().int().nonnegative().optional(),
  id: zEntityId,
  kind: z.enum(['note', 'post']),
})

export const ArticleBodiesSchema = z.object({
  items: z.array(ArticleBodyItemSchema).min(1).max(ARTICLE_BODY_BATCH_LIMIT),
})

export type ArticleBodiesDto = z.infer<typeof ArticleBodiesSchema>

export type ArticleBodyItem = z.infer<typeof ArticleBodyItemSchema>
