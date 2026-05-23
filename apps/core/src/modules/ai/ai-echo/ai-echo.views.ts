import { z } from 'zod'

const dateOrString = z.union([z.date(), z.string()])

const PublicMetadataSchema = z
  .object({
    profileRefreshedAt: z.union([dateOrString, z.null()]).optional(),
    retrievalIds: z.array(z.string()).optional(),
    memoryIds: z.array(z.string()).optional(),
  })
  .strict()

const AiEchoPublicSchema = z
  .object({
    id: z.string(),
    scenarioKey: z.string(),
    subjectType: z.string(),
    subjectId: z.string(),
    personaKey: z.string(),
    content: z.string().nullable(),
    status: z.string(),
    generatedAt: dateOrString.nullable(),
    editedAt: dateOrString.nullable(),
    metadata: PublicMetadataSchema,
  })
  .strict()

const AiEchoAdminSchema = z
  .object({
    id: z.string(),
    scenarioKey: z.string(),
    subjectType: z.string(),
    subjectId: z.string(),
    personaKey: z.string(),
    content: z.string().nullable(),
    status: z.string(),
    model: z.string().nullable(),
    metadata: z.record(z.string(), z.unknown()),
    generatedAt: dateOrString.nullable(),
    editedAt: dateOrString.nullable(),
    editedBy: z.string().nullable(),
    createdAt: dateOrString,
    updatedAt: dateOrString.nullable(),
  })
  .strict()

export const AiEchoViews = {
  public: AiEchoPublicSchema,
  admin: AiEchoAdminSchema,
} as const

export type AiEchoPublicView = z.infer<typeof AiEchoPublicSchema>
export type AiEchoAdminView = z.infer<typeof AiEchoAdminSchema>
