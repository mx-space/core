import { z } from 'zod'

import { zEntityId } from '~/common/zod'

import { normalizePublishAiResources } from './publish.types'

const PublishAiResourceSchema = z.enum([
  'insights',
  'summary',
  'translation',
  'tts',
])

const PublishAiResourceRequestSchema = z.union([
  PublishAiResourceSchema,
  z.object({
    mode: z.enum(['sync', 'async']),
    resource: PublishAiResourceSchema,
  }),
])

export const CreatePublishJobSchema = z.object({
  aiResources: z
    .array(PublishAiResourceRequestSchema)
    .max(8)
    .transform(normalizePublishAiResources)
    .optional(),
  branchId: zEntityId,
  confirmDiverged: z.boolean().default(false),
  expectedPublishedRevisionId: zEntityId.nullable(),
  revisionId: zEntityId,
})

export type CreatePublishJobDto = z.infer<typeof CreatePublishJobSchema>
