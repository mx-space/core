import { z } from 'zod'

const RegistryModelCostsSchema = z.object({
  inputPerMillion: z.number(),
  outputPerMillion: z.number(),
  cachedInputPerMillion: z.number(),
})

const RegistryModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  contextWindow: z.number(),
  maxTokens: z.number(),
  costs: RegistryModelCostsSchema,
})

export const AiViews = {
  registryModel: RegistryModelSchema,
  registryModelList: z.array(RegistryModelSchema),
} as const

export type AiView = keyof typeof AiViews
export type RegistryModelView = z.infer<typeof RegistryModelSchema>
