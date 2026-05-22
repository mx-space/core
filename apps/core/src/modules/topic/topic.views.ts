import { z } from 'zod'

const TopicCardSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    description: z.string(),
    introduce: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),
    createdAt: z.date().or(z.string()),
  })
  .passthrough()

const TopicDetailSchema = z.object({}).passthrough()

export const TopicViews = {
  card: TopicCardSchema,
  detail: TopicDetailSchema,
} as const

export type TopicView = keyof typeof TopicViews
