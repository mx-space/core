import { z } from 'zod'

export const PaginationSchema = z.object({
  page: z.number().int().positive(),
  size: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  total_pages: z.number().int().nonnegative(),
})

export const ArticleTranslationSchema = z.object({
  is_translated: z.boolean(),
  source_lang: z.string().optional(),
  target_lang: z.string().optional(),
  model: z.string().optional(),
  translated_at: z.date().optional(),
  title: z.string().optional(),
  text: z.string().optional(),
  subtitle: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  content: z.string().optional(),
  content_format: z.string().optional(),
  available_translations: z.array(z.string()).optional(),
})

export const EntryTranslationSchema = z
  .object({
    article: ArticleTranslationSchema.optional(),
    fields: z.record(z.string(), z.string()).optional(),
  })
  .strict()

export const InteractionMetaSchema = z
  .object({
    is_liked: z.boolean().optional(),
    like_count: z.number().int().nonnegative().optional(),
    read_count: z.number().int().nonnegative().optional(),
  })
  .strict()

const EnrichmentImageSchema = z.object({
  url: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
  alt: z.string().optional(),
  blurhash: z.string().optional(),
})

const EnrichmentAttributeSchema = z.object({
  key: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()]),
  label: z.string().optional(),
  format: z
    .enum(['number', 'rating', 'date', 'percent', 'text', 'duration'])
    .optional(),
})

const EnrichmentScreenshotSchema = z.object({
  url: z.string(),
  width: z.number(),
  height: z.number(),
  blurhash: z.string().optional(),
  palette: z
    .object({
      dominant: z.string(),
      swatches: z.array(z.string()).optional(),
    })
    .optional(),
})

export const EnrichmentEntrySchema = z
  .object({
    id: z.string().optional(),
    title: z.string(),
    description: z.string().optional(),
    image: EnrichmentImageSchema.optional(),
    url: z.string(),
    category: z.string(),
    subtype: z.string().optional(),
    publishedAt: z.string().optional(),
    fetchedAt: z.string().optional(),
    attributes: z.array(EnrichmentAttributeSchema).optional(),
    color: z.string().optional(),
    links: z
      .array(
        z.object({
          rel: z.string(),
          url: z.string(),
          label: z.string().optional(),
        }),
      )
      .optional(),
    screenshot: EnrichmentScreenshotSchema.optional(),
    raw: z.unknown().optional(),
  })
  .passthrough()

export const RelatedRefSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    slug: z.string().optional(),
    nid: z.number().optional(),
    type: z.string().optional(),
  })
  .passthrough()

export const InsightsMetaSchema = z
  .object({ has_in_locale: z.boolean() })
  .strict()

export const ResponseMetaSchema = z.object({
  pagination: PaginationSchema.optional(),
  view: z.string().optional(),
  translation: z
    .union([
      EntryTranslationSchema,
      z.record(z.string(), EntryTranslationSchema),
    ])
    .optional(),
  interaction: z
    .union([InteractionMetaSchema, z.record(z.string(), InteractionMetaSchema)])
    .optional(),
  enrichments: z.record(z.string().url(), EnrichmentEntrySchema).optional(),
  related: z.array(RelatedRefSchema).optional(),
  articles: z.record(z.string(), RelatedRefSchema).optional(),
  insights: InsightsMetaSchema.optional(),
})

export type Pagination = z.infer<typeof PaginationSchema>
export type ArticleTranslation = z.infer<typeof ArticleTranslationSchema>
export type EntryTranslation = z.infer<typeof EntryTranslationSchema>
export type InteractionMeta = z.infer<typeof InteractionMetaSchema>
export type EnrichmentEntry = z.infer<typeof EnrichmentEntrySchema>
export type RelatedRef = z.infer<typeof RelatedRefSchema>
export type ArticleRefMap = Record<string, RelatedRef>
export type InsightsMeta = z.infer<typeof InsightsMetaSchema>
export type ResponseMeta = z.infer<typeof ResponseMetaSchema>
