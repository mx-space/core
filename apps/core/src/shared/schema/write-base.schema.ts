import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import { zCoerceDate, zNonEmptyString } from '~/common/zod'
import { ContentFormat } from '~/shared/types/content-format.type'

import { BaseCommentIndexSchema } from './base.schema'
import { ImageArraySchema } from './image.schema'

export const WriteBaseSchema = BaseCommentIndexSchema.extend({
  title: zNonEmptyString,
  text: z.string(),
  images: ImageArraySchema.optional(),
  created: zCoerceDate.optional(),
  meta: z.record(z.string(), z.any()).optional().nullable().default(null),
  contentFormat: z
    .enum([ContentFormat.Markdown, ContentFormat.Lexical])
    .default(ContentFormat.Markdown)
    .optional(),
  content: z.string().optional(),
})

export function validateLexicalCreateContentPair(
  data: {
    content?: string
    contentFormat?: ContentFormat | string
    text?: string
  },
  ctx: z.RefinementCtx,
) {
  if (data.contentFormat !== ContentFormat.Lexical) return
  if (!data.content || data.content.length === 0) {
    ctx.addIssue({
      code: 'custom',
      message: 'content is required when contentFormat is lexical',
      path: ['content'],
    })
  }
  if (data.text === undefined) {
    ctx.addIssue({
      code: 'custom',
      message: 'text is required when contentFormat is lexical',
      path: ['text'],
    })
  }
}

export function validateLexicalPartialContentPair(
  data: {
    content?: string
    contentFormat?: ContentFormat | string
    text?: string
  },
  ctx: z.RefinementCtx,
) {
  if (data.contentFormat !== ContentFormat.Lexical) return
  const hasContent = data.content !== undefined
  const hasText = data.text !== undefined
  if (hasContent === hasText) return
  ctx.addIssue({
    code: 'custom',
    message: 'content and text must be submitted together for lexical writes',
    path: hasContent ? ['text'] : ['content'],
  })
}

export const WriteBaseSchemaWithRefine = WriteBaseSchema.superRefine(
  validateLexicalCreateContentPair,
)

export class WriteBaseDto extends createZodDto(WriteBaseSchema) {}

export type WriteBaseInput = z.infer<typeof WriteBaseSchema>

export const PartialWriteBaseSchema = WriteBaseSchema.partial()

export class PartialWriteBaseDto extends createZodDto(PartialWriteBaseSchema) {}

export type PartialWriteBaseInput = z.infer<typeof PartialWriteBaseSchema>
