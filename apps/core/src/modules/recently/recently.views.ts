import { z } from 'zod'

import { EnrichmentViews } from '../enrichment/enrichment.views'
import { RecentlyMetadataSchema } from './recently.schema'

export const RecentlyRefSummarySchema = z.object({
  id: z.string(),
  type: z.enum(['post', 'note', 'page', 'recently']),
  title: z.string().optional(),
  slug: z.string().nullable().optional(),
  nid: z.number().int().optional(),
  url: z.string().optional(),
})

const RecentlyRefCandidateSchema = RecentlyRefSummarySchema.pick({
  id: true,
  type: true,
  title: true,
})

const RecentlyCardSchema = z
  .object({
    id: z.string(),
    content: z.string(),
    type: z.string(),
    createdAt: z.date().or(z.string()),
    modifiedAt: z.date().or(z.string()).nullable().optional(),
    refType: z.string().nullable().optional(),
    refId: z.string().nullable().optional(),
    ref: RecentlyRefSummarySchema.nullable().optional(),
    up: z.number().int().optional(),
    down: z.number().int().optional(),
    commentsIndex: z.number().int().optional(),
    allowComment: z.boolean().optional(),
    metadata: RecentlyMetadataSchema.nullable().optional(),
    // Keyed by the URL found in `content`. The read path hydrates these, so a
    // client renders media cards without resolving any link itself.
    enrichments: z.record(z.string(), EnrichmentViews.result).optional(),
  })
  .passthrough()

const RecentlyDetailSchema = RecentlyCardSchema

export const RecentlyViews = {
  card: RecentlyCardSchema,
  detail: RecentlyDetailSchema,
  refCandidate: RecentlyRefCandidateSchema,
} as const

export type RecentlyView = keyof typeof RecentlyViews
