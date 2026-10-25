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

export const DraftDocumentIdSchema = z.object({
  documentId: zEntityId,
})

export type DraftDocumentIdDto = z.infer<typeof DraftDocumentIdSchema>

export const DraftShareTokenSchema = z.object({
  token: z.string().min(1).max(128),
})

export type DraftShareTokenDto = z.infer<typeof DraftShareTokenSchema>

export const SetDraftShareSchema = z.discriminatedUnion('mode', [
  z.object({ draftId: zEntityId, mode: z.literal('follow') }),
  z.object({ mode: z.literal('pinned'), revisionId: zEntityId }),
])

export type SetDraftShareDto = z.infer<typeof SetDraftShareSchema>

export const DraftCrdtQuerySchema = z.object({
  since: z.string().max(65_536).optional(),
})

export type DraftCrdtQueryDto = z.infer<typeof DraftCrdtQuerySchema>

export const DraftCheckpointSchema = z.object({
  kind: z.enum(['save', 'publish']),
})

export type DraftCheckpointDto = z.infer<typeof DraftCheckpointSchema>

export const DraftFieldsSchema = z
  .object({
    meta: z.record(z.string(), z.unknown()).optional(),
    typeSpecificData: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((value) => value.meta || value.typeSpecificData, {
    message: 'Nothing to update',
  })

export type DraftFieldsDto = z.infer<typeof DraftFieldsSchema>

export const DraftRestoreSchema = z.object({
  revisionId: zEntityId,
})

export type DraftRestoreDto = z.infer<typeof DraftRestoreSchema>

const OpIdSchema = z.object({
  counter: z.number().int().nonnegative(),
  peer: z.string().regex(/^\d+$/),
})

export const DraftUndoSchema = z.object({
  before: z.array(OpIdSchema).max(64),
  id: OpIdSchema,
})

export type DraftUndoDto = z.infer<typeof DraftUndoSchema>
