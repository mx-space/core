import { z } from 'zod'

const EnrichmentImageSchema = z
  .object({
    url: z.string(),
    width: z.number().int().optional(),
    height: z.number().int().optional(),
    alt: z.string().optional(),
    thumbhash: z.string().optional(),
    palette: z
      .object({
        dominant: z.string(),
        swatches: z.array(z.string()).optional(),
      })
      .optional(),
  })
  .passthrough()

const EnrichmentAttributeSchema = z
  .object({
    key: z.string(),
    value: z.union([z.string(), z.number(), z.boolean()]),
    label: z.string().optional(),
    format: z
      .enum(['number', 'rating', 'date', 'percent', 'text', 'duration'])
      .optional(),
  })
  .passthrough()

/**
 * Mirrors `EnrichmentResult`. `raw` is intentionally absent — it is
 * provider-shaped and of no use to a typed client.
 */
const EnrichmentResultSchema = z
  .object({
    id: z.string().optional(),
    title: z.string(),
    description: z.string().optional(),
    url: z.string(),
    category: z.string(),
    subtype: z.string().optional(),
    publishedAt: z.string().optional(),
    fetchedAt: z.string(),
    color: z.string().optional(),
    thumbnailImage: EnrichmentImageSchema.optional(),
    previewImage: EnrichmentImageSchema.optional(),
    captureImage: EnrichmentImageSchema.optional(),
    attributes: z.array(EnrichmentAttributeSchema).optional(),
    links: z
      .array(
        z.object({
          rel: z.string(),
          url: z.string(),
          label: z.string().optional(),
        }),
      )
      .optional(),
  })
  .passthrough()
  // Registered so the OpenAPI exporter hoists it into a shared component
  // instead of inlining a second copy wherever a recently entry embeds it.
  .meta({ id: 'EnrichmentResult' })

export const EnrichmentViews = {
  result: EnrichmentResultSchema,
} as const

export type EnrichmentView = keyof typeof EnrichmentViews
