import { z } from 'zod'

const RecentlyCardSchema = z
  .object({
    id: z.string(),
    content: z.string(),
    type: z.string(),
    createdAt: z.date().or(z.string()),
  })
  .passthrough()

const RecentlyDetailSchema = z.object({}).passthrough()

export const RecentlyViews = {
  card: RecentlyCardSchema,
  detail: RecentlyDetailSchema,
} as const

export type RecentlyView = keyof typeof RecentlyViews
