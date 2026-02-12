import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

/**
 * Update admin schema
 */
export const UpdateAdminSchema = z.object({
  force: z.boolean().optional(),
})

export class UpdateAdminDto extends createZodDto(UpdateAdminSchema) {}

// Type exports
export type UpdateAdminInput = z.infer<typeof UpdateAdminSchema>
