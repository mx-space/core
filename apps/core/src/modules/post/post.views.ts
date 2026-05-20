import { z } from 'zod'

const PostCardSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    slug: z.string(),
    summary: z.string().nullable().optional(),
    categoryId: z.string(),
    category: z
      .object({
        id: z.string(),
        name: z.string(),
        slug: z.string(),
        type: z.number(),
      })
      .optional(),
    createdAt: z.date().or(z.string()),
    cover: z.string().nullable().optional(),
    isPublished: z.boolean(),
    pinAt: z.date().or(z.string()).nullable().optional(),
  })
  .passthrough()

const PostSummarySchema = PostCardSchema.extend({
  tags: z.array(z.string()).optional(),
  modifiedAt: z.date().or(z.string()).nullable().optional(),
})

const PostDetailSchema = z.object({}).passthrough()

export const PostViews = {
  card: PostCardSchema,
  summary: PostSummarySchema,
  detail: PostDetailSchema,
} as const

export type PostView = keyof typeof PostViews
