import { z } from 'zod'

const dateOrString = z.union([z.date(), z.string()])

const AiMemoryDetailSchema = z
  .object({
    id: z.string(),
    scope: z.string(),
    type: z.string(),
    content: z.string(),
    confidence: z.number(),
    salience: z.number(),
    source: z.record(z.string(), z.unknown()),
    status: z.string(),
    firstSeenAt: dateOrString,
    lastSeenAt: dateOrString,
    expiresAt: dateOrString.nullable(),
    metadata: z.record(z.string(), z.unknown()),
    createdAt: dateOrString,
    updatedAt: dateOrString.nullable(),
    hasEmbedding: z.boolean(),
  })
  .strict()

export const AiMemoryViews = {
  detail: AiMemoryDetailSchema,
} as const

export type AiMemoryDetailView = z.infer<typeof AiMemoryDetailSchema>
