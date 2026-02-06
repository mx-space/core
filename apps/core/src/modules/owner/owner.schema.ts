import { zAllowedUrl, zNonEmptyString } from '~/common/zod'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const OwnerPatchSchema = z.object({
  introduce: zNonEmptyString.optional(),
  mail: z.string().email().optional(),
  url: z.string().url({ message: '请更正为正确的网址' }).optional(),
  name: z.string().optional(),
  avatar: zAllowedUrl.optional(),
  socialIds: z.record(z.string(), z.any()).optional(),
})

export class OwnerPatchDto extends createZodDto(OwnerPatchSchema) {}

export type OwnerPatchInput = z.infer<typeof OwnerPatchSchema>
