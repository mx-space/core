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

/**
 * `row` view powers the redesigned `/comments` list row (spec §7.2).
 * Adds `countryCode` (ISO 3166-1 alpha-2) populated by
 * `enrichCommentsWithCountry` so the R3 row can render a flag without a
 * follow-up lookup.
 */
const CommentRowSchema = CommentCardSchema.extend({
  countryCode: z.string().nullable().optional(),
})

const CommentDetailSchema = z.object({}).passthrough()

const AuthorActivityItemSchema = z.object({
  id: z.string(),
  createdAt: z.date().or(z.string()),
  refType: z.string(),
  refId: z.string(),
  textExcerpt: z.string(),
  state: z.number(),
  isDeleted: z.boolean(),
})

export const CommentViews = {
  card: CommentCardSchema,
  row: CommentRowSchema,
  detail: CommentDetailSchema,
  authorActivityItem: AuthorActivityItemSchema,
} as const

export type CommentView = keyof typeof CommentViews
