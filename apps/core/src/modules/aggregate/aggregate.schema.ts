import { zCoerceInt } from '~/common/zod'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

/**
 * Top query schema
 */
export const TopQuerySchema = z.object({
  size: z.preprocess(
    (val) => (typeof val === 'string' ? Number.parseInt(val, 10) : val),
    z.number().min(1).max(10).optional(),
  ),
})

export class TopQueryDto extends createZodDto(TopQuerySchema) {}

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
})

export class TimelineQueryDto extends createZodDto(TimelineQuerySchema) {}

/**
 * Aggregate query schema
 */
export const AggregateQuerySchema = z.object({
  theme: z.string().optional(),
})

export class AggregateQueryDto extends createZodDto(AggregateQuerySchema) {}

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

export class ReadAndLikeCountTypeDto extends createZodDto(
  ReadAndLikeCountTypeSchema,
) {}

// Type exports
export type TopQueryInput = z.infer<typeof TopQuerySchema>
export type TimelineQueryInput = z.infer<typeof TimelineQuerySchema>
export type AggregateQueryInput = z.infer<typeof AggregateQuerySchema>
export type ReadAndLikeCountTypeInput = z.infer<
  typeof ReadAndLikeCountTypeSchema
>
