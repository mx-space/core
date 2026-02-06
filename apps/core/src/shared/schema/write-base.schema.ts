import { zCoerceDate, zNonEmptyString } from '~/common/zod'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { BaseCommentIndexSchema } from './base.schema'
import { ImageSchema } from './image.schema'

export const WriteBaseSchema = BaseCommentIndexSchema.extend({
  title: zNonEmptyString,
  text: z.string(),
  images: z.array(ImageSchema).optional(),
  created: zCoerceDate.optional(),
  meta: z.record(z.string(), z.any()).optional().nullable().default(null),
})

export class WriteBaseDto extends createZodDto(WriteBaseSchema) {}

export type WriteBaseInput = z.infer<typeof WriteBaseSchema>

export const PartialWriteBaseSchema = WriteBaseSchema.partial()

export class PartialWriteBaseDto extends createZodDto(PartialWriteBaseSchema) {}

export type PartialWriteBaseInput = z.infer<typeof PartialWriteBaseSchema>
