import { z } from 'zod'

import { zCoerceBoolean } from '~/common/zod'
import { ArticleTypeEnum } from '~/constants/article.constant'

/**
 * Meta schema
 */
export const MetaSchema = z.object({
  title: z.string(),
  date: z.preprocess(
    (val) => new Date(val as string | number | Date),
    z.date(),
  ),
  updated: z
    .preprocess((val) => new Date(val as string | number | Date), z.date())
    .optional(),
  categories: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  slug: z.string(),
})

/**
 * Datatype schema
 */
export const DatatypeSchema = z.object({
  meta: MetaSchema.optional(),
  text: z.string(),
})

export type DatatypeDto = z.infer<typeof DatatypeSchema>

/**
 * Data list schema
 */
export const DataListSchema = z.object({
  type: z.preprocess(
    (val) => (typeof val === 'string' ? val.toLowerCase() : val),
    z.enum(ArticleTypeEnum),
  ),
  data: z.array(DatatypeSchema),
})

export type DataListDto = z.infer<typeof DataListSchema>

/**
 * Export markdown query schema
 */
export const ExportMarkdownQuerySchema = z.object({
  yaml: zCoerceBoolean.optional(),
  slug: zCoerceBoolean.optional(),
  showTitle: zCoerceBoolean.optional(),
  withMetaJson: zCoerceBoolean.optional(),
})

export type ExportMarkdownQueryDto = z.infer<typeof ExportMarkdownQuerySchema>

/**
 * Markdown preview schema
 */
export const MarkdownPreviewSchema = z.object({
  title: z.string(),
  md: z.string(),
})

export type MarkdownPreviewDto = z.infer<typeof MarkdownPreviewSchema>
