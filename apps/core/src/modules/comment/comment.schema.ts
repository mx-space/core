import { CollectionRefTypes } from '~/constants/db.constant'
import { normalizeRefType } from '~/utils/database.util'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

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
  source: z.string().optional(),
  avatar: z
    .string()
    .url({ message: '头像必须是合法的 HTTPS URL 哦' })
    .refine((val) => val.startsWith('https://'), {
      message: '头像必须是合法的 HTTPS URL 哦',
    })
    .optional(),
})

export class CommentDto extends createZodDto(CommentSchema) {}

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
  source: z.string().optional(),
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

// Type exports
export type CommentInput = z.infer<typeof CommentSchema>
export type EditCommentInput = z.infer<typeof EditCommentSchema>
export type RequiredGuestReaderCommentInput = z.infer<
  typeof RequiredGuestReaderCommentSchema
>
export type TextOnlyInput = z.infer<typeof TextOnlySchema>
export type CommentRefTypesInput = z.infer<typeof CommentRefTypesSchema>
export type CommentStatePatchInput = z.infer<typeof CommentStatePatchSchema>
