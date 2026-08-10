import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import { MAX_LANGS_PER_TASK } from '../ai.constants'

export const CreateSummaryTaskSchema = z.object({
  refId: z.string(),
  targetLanguages: z.array(z.string()).max(MAX_LANGS_PER_TASK).optional(),
  force: z.boolean().optional(),
})

export class CreateSummaryTaskDto extends createZodDto(
  CreateSummaryTaskSchema,
) {}

export const CreateTranslationTaskSchema = z.object({
  refId: z.string(),
  targetLanguages: z.array(z.string()).max(MAX_LANGS_PER_TASK).optional(),
  force: z.boolean().optional(),
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
