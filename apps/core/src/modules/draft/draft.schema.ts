import { z } from 'zod'

import {
  zCoerceBoolean,
  zEntityId,
  zPaginationPage,
  zPaginationSize,
  zSortOrder,
} from '~/common/zod'
import { validateLexicalCreateContentPair } from '~/shared/schema'
import { ContentFormat } from '~/shared/types/content-format.type'

import { DraftRefType } from './draft.enum'

const ImageModelSchema = z.object({
  alt: z.string().optional(),
  src: z.string(),
})

export const DraftWriteDataSchema = z
  .object({
    content: z.string().optional(),
    contentFormat: z
      .enum([ContentFormat.Markdown, ContentFormat.Lexical])
      .default(ContentFormat.Markdown),
    images: z.array(ImageModelSchema).nullable().optional(),
    meta: z.record(z.string(), z.unknown()).nullable().optional(),
    text: z.string().default(''),
    title: z.string().default(''),
    typeSpecificData: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .superRefine(validateLexicalCreateContentPair)

export const CreateDraftSchema = z.object({
  baseRevisionId: zEntityId.nullable().optional(),
  data: DraftWriteDataSchema,
  refId: zEntityId.optional(),
  refType: z.enum(DraftRefType),
})

export type CreateDraftDto = z.infer<typeof CreateDraftSchema>

export const UpdateDraftSchema = z.object({
  data: DraftWriteDataSchema,
  expectedHeadRevisionId: zEntityId,
})

export type UpdateDraftDto = z.infer<typeof UpdateDraftSchema>

export const DraftPagerSchema = z.object({
  hasRef: zCoerceBoolean.optional(),
  page: zPaginationPage,
  refType: z.enum(DraftRefType).optional(),
  search: z.string().optional(),
  size: zPaginationSize,
  sortBy: z.string().optional(),
  sortOrder: zSortOrder,
})

export type DraftPagerDto = z.infer<typeof DraftPagerSchema>

export const DraftRefTypeSchema = z.object({
  refType: z.enum(DraftRefType),
})

export type DraftRefTypeDto = z.infer<typeof DraftRefTypeSchema>

export const DraftRefTypeAndIdSchema = DraftRefTypeSchema.extend({
  refId: zEntityId,
})

export type DraftRefTypeAndIdDto = z.infer<typeof DraftRefTypeAndIdSchema>

export const RevisionComparisonSchema = z.object({
  leftId: zEntityId,
  rightId: zEntityId,
})

export type RevisionComparisonDto = z.infer<typeof RevisionComparisonSchema>
