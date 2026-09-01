import { z } from 'zod'

/**
 * Update admin schema
 */
export const UpdateAdminSchema = z.object({
  force: z.boolean().optional(),
})

export type UpdateAdminDto = z.infer<typeof UpdateAdminSchema>

// Type exports
export type UpdateAdminInput = z.infer<typeof UpdateAdminSchema>
