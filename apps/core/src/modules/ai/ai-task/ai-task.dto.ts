import { z } from 'zod'

import { zLanguageTag } from '~/common/zod/custom'

import { MAX_LANGS_PER_TASK } from '../ai.constants'

export const CreateSummaryTaskSchema = z.object({
  refId: z.string(),
  targetLanguages: z.array(zLanguageTag).max(MAX_LANGS_PER_TASK).optional(),
  force: z.boolean().optional(),
})

export type CreateSummaryTaskDto = z.infer<typeof CreateSummaryTaskSchema>

export const CreateSummaryTranslationTaskSchema = z.object({
  refId: z.string(),
  targetLang: zLanguageTag,
  force: z.boolean().optional(),
})

export type CreateSummaryTranslationTaskDto = z.infer<
  typeof CreateSummaryTranslationTaskSchema
>

export const CreateTranslationTaskSchema = z.object({
  refId: z.string(),
  targetLanguages: z.array(zLanguageTag).max(MAX_LANGS_PER_TASK).optional(),
  force: z.boolean().optional(),
})

export type CreateTranslationTaskDto = z.infer<
  typeof CreateTranslationTaskSchema
>

export const CreateTranslationBatchTaskSchema = z.object({
  refIds: z.array(z.string()).min(1).max(100),
  targetLanguages: z.array(zLanguageTag).optional(),
})

export type CreateTranslationBatchTaskDto = z.infer<
  typeof CreateTranslationBatchTaskSchema
>

export const CreateTranslationAllTaskSchema = z.object({
  targetLanguages: z.array(zLanguageTag).optional(),
})

export type CreateTranslationAllTaskDto = z.infer<
  typeof CreateTranslationAllTaskSchema
>
