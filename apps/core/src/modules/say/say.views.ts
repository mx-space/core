import { z } from 'zod'

const SayDetailSchema = z
  .object({
    id: z.string(),
    createdAt: z.date().or(z.string()),
    text: z.string(),
    source: z.string().nullable().optional(),
    author: z.string().nullable().optional(),
  })
  .passthrough()

export const SayViews = {
  detail: SayDetailSchema,
} as const

export type SayView = keyof typeof SayViews
