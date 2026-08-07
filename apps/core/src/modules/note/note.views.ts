import { z } from 'zod'

const NoteCardSchema = z
  .object({
    id: z.string(),
    nid: z.number().int(),
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

const NoteDetailSchema = NoteSummarySchema.extend({
  text: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
  contentFormat: z.string(),
  images: z.array(z.unknown()).nullable().optional(),
  meta: z.record(z.string(), z.unknown()).nullable().optional(),
  password: z.string().nullable().optional(),
  publicAt: z.date().or(z.string()).nullable().optional(),
  location: z.string().nullable().optional(),
  coordinates: z
    .object({ latitude: z.number(), longitude: z.number() })
    .nullable()
    .optional(),
  readCount: z.number().int().optional(),
  likeCount: z.number().int().optional(),
})

export const NoteViews = {
  card: NoteCardSchema,
  summary: NoteSummarySchema,
  detail: NoteDetailSchema,
} as const

export type NoteView = keyof typeof NoteViews
