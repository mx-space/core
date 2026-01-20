import {
  zCoerceBoolean,
  zCoerceInt,
  zMongoId,
  zNonEmptyString,
  zTransformEmptyNull,
} from '~/common/zod'
import { PagerSchema } from '~/shared/dto/pager.dto'
import { WriteBaseSchema } from '~/shared/schema'
import { ImageSchema } from '~/shared/schema/image.schema'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

/**
 * Coordinate schema
 */
export const CoordinateSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
})

/**
 * Note schema for API validation
 */
export const NoteSchema = WriteBaseSchema.extend({
  title: z
    .string()
    .transform((val) => (val.length === 0 ? '无题' : val))
    .default('无题'),
  isPublished: z.boolean().default(true).optional(),
  password: zTransformEmptyNull(z.string()).optional(),
  publicAt: z
    .preprocess(
      (val) => (val ? new Date(val as string | number | Date) : null),
      z.date().nullable(),
    )
    .optional(),
  mood: z.string().optional(),
  weather: z.string().optional(),
  bookmark: z.boolean().default(false).optional(),
  coordinates: CoordinateSchema.optional(),
  location: z.string().optional(),
  topicId: zMongoId.optional(),
  images: z.array(ImageSchema).optional(),
  /** 关联的草稿 ID，发布时标记该草稿为已发布 */
  draftId: zMongoId.optional(),
})

export class NoteDto extends createZodDto(NoteSchema) {}

/**
 * Partial note schema for PATCH operations
 */
export const PartialNoteSchema = NoteSchema.partial()

export class PartialNoteDto extends createZodDto(PartialNoteSchema) {}

/**
 * Note query schema for pagination
 */
export const NoteQuerySchema = PagerSchema.extend({
  sortBy: z
    .enum(['title', 'created', 'modified', 'weather', 'mood'])
    .optional(),
  sortOrder: z.preprocess(
    (val) => (typeof val === 'string' ? Math.trunc(Number(val)) : val),
    z.union([z.literal(1), z.literal(-1)]).optional(),
  ),
})

export class NoteQueryDto extends createZodDto(NoteQuerySchema) {}

/**
 * Note password query schema
 */
export const NotePasswordQuerySchema = z.object({
  password: zNonEmptyString.optional(),
  single: zCoerceBoolean.optional(),
})

export class NotePasswordQueryDto extends createZodDto(
  NotePasswordQuerySchema,
) {}

/**
 * List query schema
 */
export const ListQuerySchema = z.object({
  size: zCoerceInt.min(1).max(20).optional(),
})

export class ListQueryDto extends createZodDto(ListQuerySchema) {}

/**
 * Nid type schema
 */
export const NidTypeSchema = z.object({
  nid: z.preprocess(
    (val) => (typeof val === 'string' ? Number.parseInt(val, 10) : val),
    z.number().int().min(1),
  ),
})

export class NidType extends createZodDto(NidTypeSchema) {}

/**
 * Set note publish status schema
 */
export const SetNotePublishStatusSchema = z.object({
  isPublished: z.boolean(),
})

export class SetNotePublishStatusDto extends createZodDto(
  SetNotePublishStatusSchema,
) {}

// Type exports
export type CoordinateInput = z.infer<typeof CoordinateSchema>
export type NoteInput = z.infer<typeof NoteSchema>
export type PartialNoteInput = z.infer<typeof PartialNoteSchema>
export type NoteQueryInput = z.infer<typeof NoteQuerySchema>
export type NotePasswordQueryInput = z.infer<typeof NotePasswordQuerySchema>
export type ListQueryInput = z.infer<typeof ListQuerySchema>
export type NidTypeInput = z.infer<typeof NidTypeSchema>
export type SetNotePublishStatusInput = z.infer<
  typeof SetNotePublishStatusSchema
>
