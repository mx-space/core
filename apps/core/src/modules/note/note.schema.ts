import { z } from 'zod'

import {
  zCoerceBoolean,
  zCoerceInt,
  zEmptyStringToNull,
  zEntityId,
  zLang,
  zNonEmptyString,
  zPrefer,
} from '~/common/zod'
import { MarkdownToLexicalMigrationDescriptorSchema } from '~/modules/content-migration/content-migration.schema'
import { createPagerSchema } from '~/shared/dto/pager.dto'
import {
  validateLexicalCreateContentPair,
  WriteBaseSchema,
} from '~/shared/schema'
import { ImageArraySchema } from '~/shared/schema/image.schema'

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
  password: zEmptyStringToNull.optional(),
  publicAt: z
    .preprocess(
      (val) => (val ? new Date(val as string | number | Date) : null),
      z.date().nullable(),
    )
    .optional(),
  mood: z.string().nullable().optional(),
  weather: z.string().nullable().optional(),
  bookmark: z.boolean().default(false).optional(),
  coordinates: CoordinateSchema.optional().nullable(),
  location: z.string().optional().nullable(),
  topicId: zEntityId.optional().nullable(),
  images: ImageArraySchema.optional().default([]),
  migration: MarkdownToLexicalMigrationDescriptorSchema.optional(),
})

export const NoteSchema = NoteBaseSchema.superRefine(
  validateLexicalCreateContentPair,
)

export type NoteDto = z.infer<typeof NoteSchema>

/**
 * Partial note schema for PATCH operations
 * Override fields with .default() to prevent defaults from being applied during partial updates
 */
export const PartialNoteSchema = z.object({
  bookmark: z.boolean().optional(),
  mood: z.string().nullable().optional(),
  topicId: zEntityId.nullable().optional(),
  weather: z.string().nullable().optional(),
})

export type PartialNoteDto = z.infer<typeof PartialNoteSchema>

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

export type NoteQueryDto = z.infer<typeof NoteQuerySchema>

/**
 * Note password query schema
 */
export const NotePasswordQuerySchema = z.object({
  password: zNonEmptyString.optional(),
  single: zCoerceBoolean.optional(),
  lang: zLang,
  prefer: zPrefer,
})

export type NotePasswordQueryDto = z.infer<typeof NotePasswordQuerySchema>

/**
 * List query schema
 */
export const ListQuerySchema = z.object({
  size: zCoerceInt.min(1).max(20).optional(),
  lang: zLang,
})

export type ListQueryDto = z.infer<typeof ListQuerySchema>

/**
 * Nid type schema
 */
export const NidTypeSchema = z.object({
  nid: z.preprocess(
    (val) => (typeof val === 'string' ? Number.parseInt(val, 10) : val),
    z.number().int().min(1),
  ),
})

export type NidType = z.infer<typeof NidTypeSchema>

export const NoteSlugDateParamsSchema = z.object({
  year: zCoerceInt.min(1970),
  month: zCoerceInt.min(1).max(12),
  day: zCoerceInt.min(1).max(31),
  slug: zNonEmptyString,
})

export type NoteSlugDateParamsDto = z.infer<typeof NoteSlugDateParamsSchema>

/**
 * Set note publish status schema
 */
export const SetNotePublishStatusSchema = z.object({
  isPublished: z.boolean(),
})

export type SetNotePublishStatusDto = z.infer<typeof SetNotePublishStatusSchema>

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

export type NoteTopicPagerDto = z.infer<typeof NoteTopicPagerSchema>

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
