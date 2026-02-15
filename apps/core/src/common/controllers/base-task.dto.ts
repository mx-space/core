import { TaskStatus } from '~/processors/task-queue'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const BaseGetTasksQuerySchema = z.object({
  status: z
    .enum([
      TaskStatus.Pending,
      TaskStatus.Running,
      TaskStatus.Completed,
      TaskStatus.Failed,
      TaskStatus.Cancelled,
    ])
    .optional(),
  type: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(50).default(20),
})

export class BaseGetTasksQueryDto extends createZodDto(
  BaseGetTasksQuerySchema,
) {}

export const BaseDeleteTasksQuerySchema = z.object({
  status: z
    .enum([TaskStatus.Completed, TaskStatus.Failed, TaskStatus.Cancelled])
    .optional(),
  type: z.string().optional(),
  before: z.coerce.number().int().positive(),
})

export class BaseDeleteTasksQueryDto extends createZodDto(
  BaseDeleteTasksQuerySchema,
) {}
