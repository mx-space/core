import { z } from 'zod'

import { zAllowedUrl, zNonEmptyString } from '~/common/zod'

export const OwnerPatchSchema = z.object({
  introduce: zNonEmptyString.optional(),
  mail: z.email().optional(),
  url: z.url({ error: 'Please enter a valid URL' }).optional(),
  name: z.string().optional(),
  avatar: zAllowedUrl.optional(),
  socialIds: z.record(z.string(), z.any()).optional(),
})

export type OwnerPatchDto = z.infer<typeof OwnerPatchSchema>
