import { z } from 'zod'

const DraftCardSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    refType: z.string(),
    version: z.number(),
    createdAt: z.date().or(z.string()),
  })
  .passthrough()

const DraftDetailSchema = z.object({}).passthrough()

const DraftSharedSchema = z.object({
  content: z.string().nullable(),
  contentFormat: z.string(),
  createdAt: z.date().or(z.string()),
  images: z.array(z.unknown()).nullable(),
  refType: z.string(),
  text: z.string(),
  title: z.string(),
})

export const DraftViews = {
  card: DraftCardSchema,
  detail: DraftDetailSchema,
  shared: DraftSharedSchema,
} as const

export type DraftView = keyof typeof DraftViews
