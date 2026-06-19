import { z } from 'zod'

import { SkillBundleViewSchema } from '~/modules/snippet/snippet.views'

export const PaginationSchema = z.object({
  page: z.number().int().positive(),
  size: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
})

export const ArticleTranslationSchema = z
  .object({
    isTranslated: z.boolean(),
    sourceLang: z.string().nullable().optional(),
    targetLang: z.string().nullable().optional(),
    translatedAt: z.date().optional(),
    model: z.string().optional(),
    availableTranslations: z.array(z.string()).optional(),
  })
  .strict()

export const EntryTranslationSchema = z
  .object({
    article: ArticleTranslationSchema.optional(),
  })
  .strict()

export const InteractionMetaSchema = z
  .object({
    isLiked: z.boolean().optional(),
    likeCount: z.number().int().nonnegative().optional(),
    readCount: z.number().int().nonnegative().optional(),
  })
  .strict()

const EnrichmentImageSchema = z.object({
  url: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
  alt: z.string().optional(),
  thumbhash: z.string().optional(),
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
  thumbhash: z.string().optional(),
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
  .object({ hasInLocale: z.boolean() })
  .strict()

export const SummaryMetaSchema = z
  .object({
    id: z.string(),
    text: z.string(),
    lang: z.string(),
    createdAt: z.date(),
  })
  .strict()

export const BaseResponseMetaSchema = z.object({
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
})

export const PostResponseMetaSchema = BaseResponseMetaSchema.extend({
  insights: InsightsMetaSchema.optional(),
  related: z.array(RelatedRefSchema).optional(),
  articles: z.record(z.string(), RelatedRefSchema).optional(),
  summary: SummaryMetaSchema.optional(),
  skills: z.array(SkillBundleViewSchema).optional(),
})

export const NoteResponseMetaSchema = BaseResponseMetaSchema.extend({
  insights: InsightsMetaSchema.optional(),
  summary: SummaryMetaSchema.optional(),
})

/**
 * @deprecated Use `BaseResponseMetaSchema` plus a per-resource schema
 * (`PostResponseMetaSchema`, `NoteResponseMetaSchema`) instead.
 */
export const ResponseMetaSchema = PostResponseMetaSchema.merge(
  NoteResponseMetaSchema,
)

export type Pagination = z.infer<typeof PaginationSchema>
export type ArticleTranslation = z.infer<typeof ArticleTranslationSchema>
export type EntryTranslation = z.infer<typeof EntryTranslationSchema>
export type InteractionMeta = z.infer<typeof InteractionMetaSchema>
export type EnrichmentEntry = z.infer<typeof EnrichmentEntrySchema>
export type RelatedRef = z.infer<typeof RelatedRefSchema>
export type ArticleRefMap = Record<string, RelatedRef>
export type InsightsMeta = z.infer<typeof InsightsMetaSchema>
export type SummaryMeta = z.infer<typeof SummaryMetaSchema>
export type BaseResponseMeta = z.infer<typeof BaseResponseMetaSchema>
export type PostResponseMeta = z.infer<typeof PostResponseMetaSchema>
export type NoteResponseMeta = z.infer<typeof NoteResponseMetaSchema>

/**
 * @deprecated Use `BaseResponseMeta`, `PostResponseMeta`, or `NoteResponseMeta`.
 */
export type ResponseMeta = z.infer<typeof ResponseMetaSchema>

export { SkillBundleViewSchema }
