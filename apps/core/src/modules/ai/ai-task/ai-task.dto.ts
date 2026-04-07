import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import { TaskStatus } from '~/processors/task-queue'

import { AITaskType } from './ai-task.types'

export const CreateSummaryTaskSchema = z.object({
  refId: z.string(),
  targetLanguages: z.array(z.string()).optional(),
})

export class CreateSummaryTaskDto extends createZodDto(
  CreateSummaryTaskSchema,
) {}

export const CreateTranslationTaskSchema = z.object({
  refId: z.string(),
  targetLanguages: z.array(z.string()).optional(),
})

export class CreateTranslationTaskDto extends createZodDto(
  CreateTranslationTaskSchema,
) {}

export const CreateTranslationBatchTaskSchema = z.object({
  refIds: z.array(z.string()).min(1).max(100),
  targetLanguages: z.array(z.string()).optional(),
})

export class CreateTranslationBatchTaskDto extends createZodDto(
  CreateTranslationBatchTaskSchema,
) {}

export const CreateTranslationAllTaskSchema = z.object({
  targetLanguages: z.array(z.string()).optional(),
})

export class CreateTranslationAllTaskDto extends createZodDto(
  CreateTranslationAllTaskSchema,
) {}

export const CreateCoverTaskSchema = z.object({
  refId: z.string(),
  overwrite: z.boolean().optional(),
})

export class CreateCoverTaskDto extends createZodDto(CreateCoverTaskSchema) {}

export const GetTasksQuerySchema = z.object({
  status: z
    .enum([
      TaskStatus.Pending,
      TaskStatus.Running,
      TaskStatus.Completed,
      TaskStatus.Failed,
      TaskStatus.Cancelled,
    ])
    .optional(),
  type: z
    .enum([
      AITaskType.Summary,
      AITaskType.Translation,
      AITaskType.TranslationBatch,
      AITaskType.TranslationAll,
      AITaskType.SlugBackfill,
      AITaskType.Cover,
    ])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(50).default(20),
})

export class GetTasksQueryDto extends createZodDto(GetTasksQuerySchema) {}

export const DeleteTasksQuerySchema = z.object({
  status: z
    .enum([TaskStatus.Completed, TaskStatus.Failed, TaskStatus.Cancelled])
    .optional(),
  type: z
    .enum([
      AITaskType.Summary,
      AITaskType.Translation,
      AITaskType.TranslationBatch,
      AITaskType.TranslationAll,
      AITaskType.SlugBackfill,
      AITaskType.Cover,
    ])
    .optional(),
  before: z.coerce.number().int().positive(),
})

export class DeleteTasksQueryDto extends createZodDto(DeleteTasksQuerySchema) {}

export type CreateSummaryTaskInput = z.infer<typeof CreateSummaryTaskSchema>
export type CreateTranslationTaskInput = z.infer<
  typeof CreateTranslationTaskSchema
>
export type CreateTranslationBatchTaskInput = z.infer<
  typeof CreateTranslationBatchTaskSchema
>
export type CreateTranslationAllTaskInput = z.infer<
  typeof CreateTranslationAllTaskSchema
>
export type CreateCoverTaskInput = z.infer<typeof CreateCoverTaskSchema>
export type GetTasksQueryInput = z.infer<typeof GetTasksQuerySchema>
export type DeleteTasksQueryInput = z.infer<typeof DeleteTasksQuerySchema>
