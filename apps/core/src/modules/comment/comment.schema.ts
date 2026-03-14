import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import { CollectionRefTypes } from '~/constants/db.constant'
import { normalizeRefType } from '~/utils/database.util'

import { CommentAnchorMode } from './comment.model'

const BlockCommentAnchorSchema = z.object({
  mode: z.literal(CommentAnchorMode.Block),
  blockId: z.string().trim().min(1).max(128),
  blockType: z.string().trim().min(1).max(64).optional(),
  blockFingerprint: z.string().trim().min(1).max(64).optional(),
  snapshotText: z.string().max(20000).optional(),
  lang: z.string().trim().min(1).max(10).nullish(),
})

const RangeCommentAnchorSchema = z
  .object({
    mode: z.literal(CommentAnchorMode.Range),
    blockId: z.string().trim().min(1).max(128),
    blockType: z.string().trim().min(1).max(64).optional(),
    blockFingerprint: z.string().trim().min(1).max(64).optional(),
    snapshotText: z.string().max(20000).optional(),
    lang: z.string().trim().min(1).max(10).nullish(),
    quote: z.string().min(1).max(1000),
    prefix: z.string().max(300).default(''),
    suffix: z.string().max(300).default(''),
    startOffset: z.number().int().min(0),
    endOffset: z.number().int().min(0),
  })
  .refine((data) => data.endOffset >= data.startOffset, {
    message: 'endOffset must be greater than or equal to startOffset',
    path: ['endOffset'],
  })

export const CommentAnchorSchema = z.discriminatedUnion('mode', [
  BlockCommentAnchorSchema,
  RangeCommentAnchorSchema,
])

/**
 * Comment schema for API validation
 */
export const CommentSchema = z.object({
  author: z.string().min(1).max(20, { message: '昵称不得大于 20 个字符' }),
  text: z.string().min(1).max(500, { message: '评论内容不得大于 500 个字符' }),
  mail: z
    .string()
    .email({ message: '请更正为正确的邮箱' })
    .max(50, { message: '邮箱地址不得大于 50 个字符' }),
  url: z
    .string()
    .url({ message: '请更正为正确的网址' })
    .max(50, { message: '地址不得大于 50 个字符' })
    .optional(),
  isWhispers: z.boolean().optional(),
  avatar: z
    .string()
    .url({ message: '头像必须是合法的 HTTPS URL 哦' })
    .refine((val) => val.startsWith('https://'), {
      message: '头像必须是合法的 HTTPS URL 哦',
    })
    .optional(),
  anchor: CommentAnchorSchema.optional(),
})

export const AnonymousCommentSchema = CommentSchema
export const AnonymousReplyCommentSchema = CommentSchema.omit({ anchor: true })

export const ReaderCommentSchema = z.object({
  text: z.string().min(1).max(500, { message: '评论内容不得大于 500 个字符' }),
  isWhispers: z.boolean().optional(),
  anchor: CommentAnchorSchema.optional(),
})

export const ReaderReplyCommentSchema = ReaderCommentSchema.omit({
  anchor: true,
})

export class CommentDto extends createZodDto(AnonymousCommentSchema) {}
export class ReplyCommentDto extends createZodDto(
  AnonymousReplyCommentSchema,
) {}
export class ReaderCommentDto extends createZodDto(ReaderCommentSchema) {}
export class ReaderReplyCommentDto extends createZodDto(
  ReaderReplyCommentSchema,
) {}

/**
 * Edit comment schema
 */
export const EditCommentSchema = z.object({
  text: z.string().min(1),
})

export class EditCommentDto extends createZodDto(EditCommentSchema) {}

/**
 * Required guest reader comment schema
 */
export const RequiredGuestReaderCommentSchema = CommentSchema.extend({
  author: z.string().min(1).max(20, { message: '昵称不得大于 20 个字符' }),
  mail: z
    .string()
    .email({ message: '请更正为正确的邮箱' })
    .max(50, { message: '邮箱地址不得大于 50 个字符' }),
})

export class RequiredGuestReaderCommentDto extends createZodDto(
  RequiredGuestReaderCommentSchema,
) {}

/**
 * Text only schema
 */
export const TextOnlySchema = z.object({
  text: z.string().min(1),
  anchor: CommentAnchorSchema.optional(),
})

export class TextOnlyDto extends createZodDto(TextOnlySchema) {}

/**
 * Comment ref types schema
 */
export const CommentRefTypesSchema = z.object({
  ref: z
    .preprocess((val) => {
      if (!val) return undefined
      return normalizeRefType(val as any)
    }, z.enum(CollectionRefTypes))
    .optional(),
})

export class CommentRefTypesDto extends createZodDto(CommentRefTypesSchema) {}

/**
 * Comment state patch schema
 */
export const CommentStatePatchSchema = z.object({
  state: z
    .number()
    .int()
    .refine((val) => [0, 1, 2].includes(val))
    .optional(),
  pin: z.boolean().optional(),
})

export class CommentStatePatchDto extends createZodDto(
  CommentStatePatchSchema,
) {}

/**
 * Batch update comment state schema
 */
export const BatchCommentStateSchema = z
  .object({
    ids: z.array(z.string()).optional(),
    all: z.boolean().optional(),
    state: z
      .number()
      .int()
      .refine((val) => [0, 1, 2].includes(val)),
    currentState: z
      .number()
      .int()
      .refine((val) => [0, 1, 2].includes(val))
      .optional(),
  })
  .refine((data) => data.ids?.length || data.all, {
    message: 'Either ids or all must be provided',
  })

export class BatchCommentStateDto extends createZodDto(
  BatchCommentStateSchema,
) {}

/**
 * Batch delete comment schema
 */
export const BatchCommentDeleteSchema = z
  .object({
    ids: z.array(z.string()).optional(),
    all: z.boolean().optional(),
    state: z
      .number()
      .int()
      .refine((val) => [0, 1, 2].includes(val))
      .optional(),
  })
  .refine((data) => data.ids?.length || data.all, {
    message: 'Either ids or all must be provided',
  })

export class BatchCommentDeleteDto extends createZodDto(
  BatchCommentDeleteSchema,
) {}

// Type exports
export type CommentInput = z.infer<typeof CommentSchema>
export type AnonymousCommentInput = z.infer<typeof AnonymousCommentSchema>
export type AnonymousReplyCommentInput = z.infer<
  typeof AnonymousReplyCommentSchema
>
export type ReaderCommentInput = z.infer<typeof ReaderCommentSchema>
export type ReaderReplyCommentInput = z.infer<typeof ReaderReplyCommentSchema>
export type CommentAnchorInput = z.infer<typeof CommentAnchorSchema>
export type EditCommentInput = z.infer<typeof EditCommentSchema>
export type RequiredGuestReaderCommentInput = z.infer<
  typeof RequiredGuestReaderCommentSchema
>
export type TextOnlyInput = z.infer<typeof TextOnlySchema>
export type CommentRefTypesInput = z.infer<typeof CommentRefTypesSchema>
export type CommentStatePatchInput = z.infer<typeof CommentStatePatchSchema>
