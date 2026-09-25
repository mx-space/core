import { z } from 'zod'

const CategoryCardSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    type: z.number(),
    createdAt: z.date().or(z.string()),
  })
  .loose()

const CategoryDetailSchema = z.object({}).loose()

export const CategoryViews = {
  card: CategoryCardSchema,
  detail: CategoryDetailSchema,
} as const

export type CategoryView = keyof typeof CategoryViews
