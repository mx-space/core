import { z } from 'zod'

const NoteCardSchema = z
  .object({
    id: z.string(),
    nid: z.number(),
    title: z.string(),
    slug: z.string().nullable().optional(),
    mood: z.string().nullable().optional(),
    weather: z.string().nullable().optional(),
    createdAt: z.date().or(z.string()),
    isPublished: z.boolean(),
    bookmark: z.boolean(),
  })
  .passthrough()

const NoteSummarySchema = NoteCardSchema.extend({
  modifiedAt: z.date().or(z.string()).nullable().optional(),
  topicId: z.string().nullable().optional(),
  topic: z
    .object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
    })
    .nullable()
    .optional(),
})

const NoteDetailSchema = z.object({}).passthrough()

export const NoteViews = {
  card: NoteCardSchema,
  summary: NoteSummarySchema,
  detail: NoteDetailSchema,
} as const

export type NoteView = keyof typeof NoteViews
