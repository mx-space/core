import { zMongoId } from '~/common/zod'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export enum RecentlyAttitudeEnum {
  Up,
  Down,
}

/**
 * Recently schema for API validation
 */
export const RecentlySchema = z.object({
  content: z.string().min(1),
  ref: zMongoId.optional(),
  refType: z.string().optional(),
})

export class RecentlyDto extends createZodDto(RecentlySchema) {}

/**
 * Recently attitude schema
 */
export const RecentlyAttitudeSchema = z.object({
  attitude: z.preprocess(
    (val) => (typeof val === 'string' ? Number(val) : val),
    z.enum(RecentlyAttitudeEnum),
  ),
})

export class RecentlyAttitudeDto extends createZodDto(RecentlyAttitudeSchema) {}

// Type exports
export type RecentlyInput = z.infer<typeof RecentlySchema>
export type RecentlyAttitudeInput = z.infer<typeof RecentlyAttitudeSchema>
