import { z } from 'zod'

export const RegistryModelsQuerySchema = z.object({
  providerId: z.string().min(1, 'providerId is required'),
})

export type RegistryModelsQueryDto = z.infer<typeof RegistryModelsQuerySchema>
