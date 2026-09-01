import { z } from 'zod'

import { zEntityId } from '~/common/zod'

const PublishAiResourceSchema = z.enum([
  'insights',
  'summary',
  'translation',
  'tts',
])

export const CreatePublishJobSchema = z.object({
  aiResources: z.array(PublishAiResourceSchema).max(4).default([]),
  branchId: zEntityId,
  confirmDiverged: z.boolean().default(false),
  expectedPublishedRevisionId: zEntityId.nullable(),
  revisionId: zEntityId,
})

export type CreatePublishJobDto = z.infer<typeof CreatePublishJobSchema>
