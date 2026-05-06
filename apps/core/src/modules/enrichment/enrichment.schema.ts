import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const ResolveQuerySchema = z.object({
  url: z.string().url(),
})
export class ResolveQueryDto extends createZodDto(ResolveQuerySchema) {}

export const AdminListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
})
export class AdminListQueryDto extends createZodDto(AdminListQuerySchema) {}
