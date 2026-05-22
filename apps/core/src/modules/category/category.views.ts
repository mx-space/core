import { z } from 'zod'

const CategoryCardSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    type: z.number(),
    createdAt: z.date().or(z.string()),
  })
  .passthrough()

const CategoryDetailSchema = z.object({}).passthrough()

export const CategoryViews = {
  card: CategoryCardSchema,
  detail: CategoryDetailSchema,
} as const

export type CategoryView = keyof typeof CategoryViews
