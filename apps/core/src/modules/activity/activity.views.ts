import { z } from 'zod'

const ActivityReferenceSchema = z.object({
  id: z.string().optional(),
  nid: z.number().int().optional(),
  slug: z.string().optional(),
  title: z.string().nullable().optional(),
})

const RecentLikeSchema = z.object({
  createdAt: z.date().or(z.string()),
  id: z.string(),
  nid: z.number().int().optional(),
  slug: z.string().optional(),
  title: z.string().nullable().optional(),
  type: z.string().optional(),
})

const RecentCommentSchema = z.object({
  author: z.string(),
  avatar: z.string().optional(),
  createdAt: z.date().or(z.string()),
  id: z.string().optional(),
  nid: z.number().int().optional(),
  slug: z.string().optional(),
  text: z.string(),
  title: z.string().nullable().optional(),
  type: z.string().optional(),
})

const RecentActivitiesSchema = z
  .object({
    comment: z.array(RecentCommentSchema),
    like: z.array(RecentLikeSchema),
  })
  .passthrough()

const ReadingRankSchema = z.object({
  count: z.number().int(),
  ref: ActivityReferenceSchema.optional(),
  refId: z.string(),
})

export const ActivityViews = {
  recent: RecentActivitiesSchema,
  readingRank: ReadingRankSchema,
} as const
