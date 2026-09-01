import { z } from 'zod'

import { zEntityId } from '~/common/zod'
import { ArticleTypeEnum } from '~/constants/article.constant'

export enum AckEventType {
  READ = 'read',
}

export const AckSchema = z.object({
  type: z.enum(AckEventType),
  payload: z.any(),
})

export type AckDto = z.infer<typeof AckSchema>

export const AckReadPayloadSchema = z.object({
  type: z.enum(ArticleTypeEnum),
  id: zEntityId,
})
