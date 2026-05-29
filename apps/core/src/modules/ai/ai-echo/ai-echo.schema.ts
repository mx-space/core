import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

const ECHO_STATUSES = [
  'pending',
  'generating',
  'ready',
  'edited',
  'failed',
  'archived',
] as const

export const RegenerateEchoSchema = z.object({
  personaKey: z.string().min(1),
  force: z.boolean().optional().default(false),
})

export class RegenerateEchoDto extends createZodDto(RegenerateEchoSchema) {}

export const EditEchoSchema = z.object({
  content: z.string().min(1).max(8000),
})

export class EditEchoDto extends createZodDto(EditEchoSchema) {}

export const AdminListEchoQuerySchema = z.object({
  scenarioKey: z.string().optional(),
  status: z.enum(ECHO_STATUSES).optional(),
  personaKey: z.string().optional(),
  subjectType: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
})

export class AdminListEchoQueryDto extends createZodDto(
  AdminListEchoQuerySchema,
) {}

export const SubjectParamsSchema = z.object({
  subjectType: z.string().min(1),
  subjectId: z.string().min(1),
})

export class SubjectParamsDto extends createZodDto(SubjectParamsSchema) {}

export type RegenerateEchoInput = z.infer<typeof RegenerateEchoSchema>
export type EditEchoInput = z.infer<typeof EditEchoSchema>
export type AdminListEchoQueryInput = z.infer<typeof AdminListEchoQuerySchema>
