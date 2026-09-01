import { z } from 'zod'

import { zCoerceInt, zLang } from '~/common/zod'

/**
 * Top query schema
 */
export const TopQuerySchema = z.object({
  size: z.preprocess(
    (val) => (typeof val === 'string' ? Number.parseInt(val, 10) : val),
    z.number().min(1).max(10).optional(),
  ),
})

export type TopQueryDto = z.infer<typeof TopQuerySchema>

export enum TimelineType {
  Post,
  Note,
}

/**
 * Timeline query schema
 */
export const TimelineQuerySchema = z.object({
  sort: z.preprocess(
    (val) => (typeof val === 'string' ? Number(val) : val),
    z.union([z.literal(1), z.literal(-1)]).optional(),
  ),
  year: zCoerceInt.optional(),
  type: z.preprocess(
    (val) => (typeof val === 'string' ? Math.trunc(Number(val)) : val),
    z.enum(TimelineType).optional(),
  ),
  lang: zLang,
})

export type TimelineQueryDto = z.infer<typeof TimelineQuerySchema>

/**
 * Aggregate query schema
 */
export const AggregateQuerySchema = z.object({
  theme: z.string().optional(),
  lang: zLang,
})

export type AggregateQueryDto = z.infer<typeof AggregateQuerySchema>

export enum ReadAndLikeCountDocumentType {
  Post,
  Note,
  All,
}

/**
 * Read and like count type schema
 */
export const ReadAndLikeCountTypeSchema = z.object({
  type: z.preprocess(
    (val) => (typeof val === 'string' ? Math.trunc(Number(val)) : val),
    z.enum(ReadAndLikeCountDocumentType).optional(),
  ),
})

export type ReadAndLikeCountTypeDto = z.infer<typeof ReadAndLikeCountTypeSchema>

/**
 * Latest query schema
 */
export const LatestQuerySchema = z.object({
  limit: z.preprocess(
    (val) => (typeof val === 'string' ? Number.parseInt(val, 10) : val),
    z.number().min(1).max(20).optional(),
  ),
  types: z.preprocess(
    (val) => {
      if (typeof val === 'string') return val.split(',').map(Number)
      if (Array.isArray(val)) return val.map(Number)
      return val
    },
    z.array(z.nativeEnum(TimelineType)).optional(),
  ),
  combined: z.preprocess(
    (val) => val === 'true' || val === true,
    z.boolean().optional(),
  ),
})

export type LatestQueryDto = z.infer<typeof LatestQuerySchema>

// Type exports
export type TopQueryInput = z.infer<typeof TopQuerySchema>
export type TimelineQueryInput = z.infer<typeof TimelineQuerySchema>
export type AggregateQueryInput = z.infer<typeof AggregateQuerySchema>
export type ReadAndLikeCountTypeInput = z.infer<
  typeof ReadAndLikeCountTypeSchema
>
export type LatestQueryInput = z.infer<typeof LatestQuerySchema>
