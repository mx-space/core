import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import {
  AI_MEMORY_SCOPE_REGEX,
  AI_MEMORY_STATUSES,
  AI_MEMORY_TYPES,
} from './ai-memory.constants'

export const CreateMemorySchema = z.object({
  scope: z.string().regex(AI_MEMORY_SCOPE_REGEX),
  type: z.enum(AI_MEMORY_TYPES),
  content: z.string().min(1).max(2000),
  confidence: z.number().min(0).max(1).optional().default(1),
  salience: z.number().min(0).max(10).optional().default(1),
  expiresAt: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export class CreateMemoryDto extends createZodDto(CreateMemorySchema) {}

export const UpdateMemorySchema = CreateMemorySchema.partial()

export class UpdateMemoryDto extends createZodDto(UpdateMemorySchema) {}

export const ListMemoryQuerySchema = z.object({
  scope: z.string().optional(),
  type: z.enum(AI_MEMORY_TYPES).optional(),
  status: z.enum(AI_MEMORY_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
})

export class ListMemoryQueryDto extends createZodDto(ListMemoryQuerySchema) {}

export type CreateMemoryInput = z.infer<typeof CreateMemorySchema>
export type UpdateMemoryInput = z.infer<typeof UpdateMemorySchema>
export type ListMemoryQueryInput = z.infer<typeof ListMemoryQuerySchema>
