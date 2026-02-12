import { zAllowedUrl } from '~/common/zod'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const InitOwnerCreateSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
  name: z.string().trim().min(1).optional(),
  mail: z.string().trim().email(),
  url: zAllowedUrl.optional(),
  avatar: zAllowedUrl.optional(),
  introduce: z.string().trim().optional(),
  socialIds: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
})

export class InitOwnerCreateDto extends createZodDto(InitOwnerCreateSchema) {}

export type InitOwnerCreateInput = z.infer<typeof InitOwnerCreateSchema>
