import { z } from 'zod'

export const ContentUsageQuerySchema = z.object({
  urls: z.array(z.string().trim().min(1).max(2048)).min(1).max(500),
})

export type ContentUsageQueryDto = z.infer<typeof ContentUsageQuerySchema>
