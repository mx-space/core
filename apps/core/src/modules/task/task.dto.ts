import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import {
  zCoercePositiveInt,
  zOptionalBoolean,
  zPaginationPage,
  zPaginationSize,
} from '~/common/zod'
import { TaskStatus } from '~/processors/task-queue'

const taskStatusEnum = z.enum([
  TaskStatus.Pending,
  TaskStatus.Running,
  TaskStatus.Completed,
  TaskStatus.PartialFailed,
  TaskStatus.Failed,
  TaskStatus.Cancelled,
])

export const GetTasksQuerySchema = z.object({
  scope: z.string().optional(),
  type: z.string().optional(),
  status: z.preprocess(
    (value) => (typeof value === 'string' ? value.split(',') : value),
    z.array(taskStatusEnum).nonempty().optional(),
  ),
  page: zPaginationPage,
  size: zPaginationSize,
  includeSubTasks: zOptionalBoolean,
})

export class GetTasksQueryDto extends createZodDto(GetTasksQuerySchema) {}

export const DeleteTasksQuerySchema = z.object({
  scope: z.string().optional(),
  type: z.string().optional(),
  status: z
    .enum([
      TaskStatus.Completed,
      TaskStatus.PartialFailed,
      TaskStatus.Failed,
      TaskStatus.Cancelled,
    ])
    .optional(),
  before: zCoercePositiveInt,
})

export class DeleteTasksQueryDto extends createZodDto(DeleteTasksQuerySchema) {}
