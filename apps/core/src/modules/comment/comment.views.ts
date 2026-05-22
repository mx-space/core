import { z } from 'zod'

const CommentCardSchema = z
  .object({
    id: z.string(),
    author: z.string().nullable().optional(),
    text: z.string(),
    state: z.number(),
    createdAt: z.date().or(z.string()),
    refType: z.string(),
    refId: z.string(),
  })
  .passthrough()

const CommentDetailSchema = z.object({}).passthrough()

export const CommentViews = {
  card: CommentCardSchema,
  detail: CommentDetailSchema,
} as const

export type CommentView = keyof typeof CommentViews
