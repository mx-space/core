import { z } from 'zod'

import { EnrichmentViews } from '../enrichment/enrichment.views'

const RecentlyCardSchema = z
  .object({
    id: z.string(),
    content: z.string(),
    type: z.string(),
    createdAt: z.date().or(z.string()),
    modifiedAt: z.date().or(z.string()).nullable().optional(),
    refType: z.string().nullable().optional(),
    refId: z.string().nullable().optional(),
    up: z.number().int().optional(),
    down: z.number().int().optional(),
    commentsIndex: z.number().int().optional(),
    allowComment: z.boolean().optional(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
    // Keyed by the URL found in `content`. The read path hydrates these, so a
    // client renders media cards without resolving any link itself.
    enrichments: z.record(z.string(), EnrichmentViews.result).optional(),
  })
  .passthrough()

const RecentlyDetailSchema = RecentlyCardSchema.extend({
  ref: z.record(z.string(), z.unknown()).nullable().optional(),
})

export const RecentlyViews = {
  card: RecentlyCardSchema,
  detail: RecentlyDetailSchema,
} as const

export type RecentlyView = keyof typeof RecentlyViews
