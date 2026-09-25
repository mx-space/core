import { z } from 'zod'

const PageCardSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    slug: z.string(),
    subtitle: z.string().nullable().optional(),
    order: z.number(),
    createdAt: z.date().or(z.string()),
  })
  .loose()

const PageSummarySchema = PageCardSchema.extend({
  modifiedAt: z.date().or(z.string()).nullable().optional(),
})

const PageDetailSchema = z.object({}).loose()

export const PageViews = {
  card: PageCardSchema,
  summary: PageSummarySchema,
  detail: PageDetailSchema,
} as const

export type PageView = keyof typeof PageViews
