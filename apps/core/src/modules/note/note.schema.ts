import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import {
  zCoerceBoolean,
  zCoerceInt,
  zEntityId,
  zLang,
  zNonEmptyString,
  zPrefer,
  zTransformEmptyNull,
} from '~/common/zod'
import { createPagerSchema } from '~/shared/dto/pager.dto'
import {
  validateLexicalCreateContentPair,
  validateLexicalPartialContentPair,
  WriteBaseSchema,
} from '~/shared/schema'
import { ImageArraySchema } from '~/shared/schema/image.schema'
import { ContentFormat } from '~/shared/types/content-format.type'

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
const NoteBaseSchema = WriteBaseSchema.extend({
  title: z
    .string()
    .transform((val) => (val.length === 0 ? 'Untitled' : val))
    .default('Untitled'),
  slug: z.preprocess((val) => {
    if (typeof val !== 'string') {
      return val
    }
    const trimmed = val.trim()
    return trimmed.length === 0 ? undefined : trimmed
  }, z.string().optional()),
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
  coordinates: CoordinateSchema.optional().nullable(),
  location: z.string().optional().nullable(),
  topicId: zEntityId.optional().nullable(),
  images: ImageArraySchema.optional().default([]),
  /** ID of the associated draft; marked as published when this note is published */
  draftId: zEntityId.optional(),
})

export const NoteSchema = NoteBaseSchema.superRefine(
  validateLexicalCreateContentPair,
)

export class NoteDto extends createZodDto(NoteSchema) {}

/**
 * Partial note schema for PATCH operations
 * Override fields with .default() to prevent defaults from being applied during partial updates
 */
export const PartialNoteSchema = NoteBaseSchema.extend({
  title: z
    .string()
    .transform((val) => (val.length === 0 ? 'Untitled' : val))
    .optional(),
  contentFormat: z
    .enum([ContentFormat.Markdown, ContentFormat.Lexical])
    .optional(),
  meta: z.record(z.string(), z.any()).optional().nullable(),
  isPublished: z.boolean().optional(),
  bookmark: z.boolean().optional(),
  images: ImageArraySchema.optional(),
})
  .partial()
  .superRefine(validateLexicalPartialContentPair)

export class PartialNoteDto extends createZodDto(PartialNoteSchema) {}

/**
 * Note query schema for pagination
 */
export const NoteQuerySchema = createPagerSchema([
  'title',
  'createdAt',
  'modifiedAt',
  'weather',
  'mood',
]).extend({
  lang: zLang,
  withSummary: zCoerceBoolean.optional(),
})

export class NoteQueryDto extends createZodDto(NoteQuerySchema) {}

/**
 * Note password query schema
 */
export const NotePasswordQuerySchema = z.object({
  password: zNonEmptyString.optional(),
  single: zCoerceBoolean.optional(),
  lang: zLang,
  prefer: zPrefer,
})

export class NotePasswordQueryDto extends createZodDto(
  NotePasswordQuerySchema,
) {}

/**
 * List query schema
 */
export const ListQuerySchema = z.object({
  size: zCoerceInt.min(1).max(20).optional(),
  lang: zLang,
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

export const NoteSlugDateParamsSchema = z.object({
  year: zCoerceInt.min(1970),
  month: zCoerceInt.min(1).max(12),
  day: zCoerceInt.min(1).max(31),
  slug: zNonEmptyString,
})

export class NoteSlugDateParamsDto extends createZodDto(
  NoteSlugDateParamsSchema,
) {}

/**
 * Set note publish status schema
 */
export const SetNotePublishStatusSchema = z.object({
  isPublished: z.boolean(),
})

export class SetNotePublishStatusDto extends createZodDto(
  SetNotePublishStatusSchema,
) {}

/**
 * Note topic pager schema (extends pager with lang support)
 */
export const NoteTopicPagerSchema = createPagerSchema([
  'title',
  'createdAt',
  'modifiedAt',
  'weather',
  'mood',
]).extend({
  lang: zLang,
})

export class NoteTopicPagerDto extends createZodDto(NoteTopicPagerSchema) {}

// Type exports
export type CoordinateInput = z.infer<typeof CoordinateSchema>
export type NoteInput = z.infer<typeof NoteSchema>
export type PartialNoteInput = z.infer<typeof PartialNoteSchema>
export type NoteQueryInput = z.infer<typeof NoteQuerySchema>
export type NotePasswordQueryInput = z.infer<typeof NotePasswordQuerySchema>
export type ListQueryInput = z.infer<typeof ListQuerySchema>
export type NidTypeInput = z.infer<typeof NidTypeSchema>
export type NoteSlugDateParamsInput = z.infer<typeof NoteSlugDateParamsSchema>
export type SetNotePublishStatusInput = z.infer<
  typeof SetNotePublishStatusSchema
>
