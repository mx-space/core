import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const RegistryModelsQuerySchema = z.object({
  providerId: z.string().min(1, 'providerId is required'),
})

export class RegistryModelsQueryDto extends createZodDto(
  RegistryModelsQuerySchema,
) {}

export type RegistryModelsQueryInput = z.infer<typeof RegistryModelsQuerySchema>
