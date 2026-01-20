import { zCoerceDate, zNonEmptyString } from '~/common/zod'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { BaseCommentIndexSchema } from './base.schema'
import { ImageSchema } from './image.schema'

/**
 * Write base schema - matches WriteBaseModel from shared/model/write-base.model.ts
 *
 * Base schema for content types (posts, notes, pages) with:
 * - title: required non-empty string
 * - text: content body
 * - images: optional array of images
 * - created: optional timestamp override
 * - meta: optional metadata object
 */
export const WriteBaseSchema = BaseCommentIndexSchema.extend({
  title: zNonEmptyString,
  text: z.string(),
  images: z.array(ImageSchema).optional(),
  created: zCoerceDate.optional(),
  meta: z.record(z.string(), z.any()).optional(),
})

export class WriteBaseDto extends createZodDto(WriteBaseSchema) {}

export type WriteBaseInput = z.infer<typeof WriteBaseSchema>

/**
 * Partial write base schema for PATCH operations
 */
export const PartialWriteBaseSchema = WriteBaseSchema.partial()

export class PartialWriteBaseDto extends createZodDto(PartialWriteBaseSchema) {}

export type PartialWriteBaseInput = z.infer<typeof PartialWriteBaseSchema>
