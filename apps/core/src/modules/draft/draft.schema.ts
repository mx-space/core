import {
  zCoerceBoolean,
  zMongoId,
  zPaginationPage,
  zPaginationSize,
  zSortOrder,
} from '~/common/zod'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { DraftRefType } from './draft.model'

const ImageModelSchema = z.object({
  src: z.string(),
  alt: z.string().optional(),
})

export const CreateDraftSchema = z.object({
  refType: z.enum(DraftRefType),
  refId: zMongoId.optional(),
  title: z.string().optional(),
  text: z.string().optional(),
  images: z.array(ImageModelSchema).optional(),
  meta: z.record(z.string(), z.any()).optional(),
  typeSpecificData: z.record(z.string(), z.any()).optional(),
})

export class CreateDraftDto extends createZodDto(CreateDraftSchema) {}

export const UpdateDraftSchema = CreateDraftSchema.partial()

export class UpdateDraftDto extends createZodDto(UpdateDraftSchema) {}

export const DraftPagerSchema = z.object({
  size: zPaginationSize,
  page: zPaginationPage,
  select: z.string().min(1).optional(),
  sortBy: z.string().optional(),
  sortOrder: zSortOrder,
  refType: z.enum(DraftRefType).optional(),
  hasRef: zCoerceBoolean.optional(),
})

export class DraftPagerDto extends createZodDto(DraftPagerSchema) {}

export const DraftRefTypeSchema = z.object({
  refType: z.enum(DraftRefType),
})

export class DraftRefTypeDto extends createZodDto(DraftRefTypeSchema) {}

export const DraftRefTypeAndIdSchema = DraftRefTypeSchema.extend({
  refId: zMongoId,
})

export class DraftRefTypeAndIdDto extends createZodDto(
  DraftRefTypeAndIdSchema,
) {}

export const RestoreVersionSchema = z.object({
  version: z.preprocess(
    (val) => Number.parseInt(val as string, 10),
    z.number().int().min(1),
  ),
})

export class RestoreVersionDto extends createZodDto(RestoreVersionSchema) {}

export type CreateDraftInput = z.infer<typeof CreateDraftSchema>
export type UpdateDraftInput = z.infer<typeof UpdateDraftSchema>
export type DraftPagerInput = z.infer<typeof DraftPagerSchema>
export type DraftRefTypeInput = z.infer<typeof DraftRefTypeSchema>
export type DraftRefTypeAndIdInput = z.infer<typeof DraftRefTypeAndIdSchema>
export type RestoreVersionInput = z.infer<typeof RestoreVersionSchema>
