import { z } from 'zod'

const SegmentSchema = z.object({
  blockId: z.string(),
  chunkIndex: z.number(),
  text: z.string(),
  url: z.string(),
})

export const AiTtsViews = {
  public: z.object({
    lang: z.string(),
    model: z.string(),
    voice: z.string(),
    blockOrder: z.array(z.string()),
    segments: z.array(SegmentSchema),
  }),
  detail: z.object({
    id: z.string(),
    refId: z.string(),
    lang: z.string(),
    isTranslation: z.boolean(),
    model: z.string(),
    voice: z.string(),
    speed: z.number(),
    blockOrder: z.array(z.string()),
    charCount: z.number(),
    updatedAt: z.date().nullish(),
    segments: z.array(SegmentSchema),
  }),
  listItem: z.object({
    id: z.string(),
    refId: z.string(),
    lang: z.string(),
    blockCount: z.number(),
    charCount: z.number(),
    updatedAt: z.date().nullish(),
  }),
} as const

export type AiTtsPublicView = z.infer<typeof AiTtsViews.public>
export type AiTtsDetailView = z.infer<typeof AiTtsViews.detail>
export type AiTtsListItemView = z.infer<typeof AiTtsViews.listItem>
