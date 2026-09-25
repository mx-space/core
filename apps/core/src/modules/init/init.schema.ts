import { z } from 'zod'

import { zAllowedUrl } from '~/common/zod'

export const InitOwnerCreateSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
  name: z.string().trim().min(1).optional(),
  mail: z.string().trim().pipe(z.email()),
  url: zAllowedUrl.optional(),
  avatar: zAllowedUrl.optional(),
  introduce: z.string().trim().optional(),
  socialIds: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
})

export type InitOwnerCreateDto = z.infer<typeof InitOwnerCreateSchema>
