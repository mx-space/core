import { zCoerceInt, zMongoId } from '~/common/zod'
import { PagerSchema } from '~/shared/dto/pager.dto'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { Activity } from './activity.constant'
import type { ActivityLikeSupportType } from './activity.interface'

const transformEnum = (val: any) =>
  typeof val === 'undefined' ? val : Number(val)

/**
 * Activity type params schema
 */
export const ActivityTypeParamsSchema = z.object({
  type: z.preprocess((val) => transformEnum(val), z.enum(Activity)),
})

export class ActivityTypeParamsDto extends createZodDto(
  ActivityTypeParamsSchema,
) {}

/**
 * Activity delete schema
 */
export const ActivityDeleteSchema = z.object({
  before: z.number().optional(),
})

export class ActivityDeleteDto extends createZodDto(ActivityDeleteSchema) {}

/**
 * Activity query schema
 */
export const ActivityQuerySchema = PagerSchema.extend({
  type: z.preprocess((val) => transformEnum(val), z.enum(Activity).optional()),
})

export class ActivityQueryDto extends createZodDto(ActivityQuerySchema) {}

/**
 * Activity range schema
 */
export const ActivityRangeSchema = z.object({
  start: zCoerceInt.optional(),
  end: zCoerceInt.optional(),
})

export class ActivityRangeDto extends createZodDto(ActivityRangeSchema) {}

/**
 * Activity notification schema
 */
export const ActivityNotificationSchema = z.object({
  from: zCoerceInt,
})

export class ActivityNotificationDto extends createZodDto(
  ActivityNotificationSchema,
) {}

/**
 * Like body schema
 */
export const LikeBodySchema = z.object({
  id: zMongoId,
  type: z.enum([
    'Post',
    'Note',
    'note',
    'post',
  ]) as z.ZodType<ActivityLikeSupportType>,
})

export class LikeBodyDto extends createZodDto(LikeBodySchema) {}

/**
 * Update presence schema
 */
export const UpdatePresenceSchema = z.object({
  identity: z.string().max(200),
  roomName: z.string().max(50),
  ts: z.number(),
  position: z.number().min(0),
  displayName: z.string().max(50).optional(),
  sid: z.string().max(30),
  readerId: zMongoId.optional(),
})

export class UpdatePresenceDto extends createZodDto(UpdatePresenceSchema) {}

/**
 * Get presence query schema
 */
export const GetPresenceQuerySchema = z.object({
  room_name: z.string().max(50),
})

export class GetPresenceQueryDto extends createZodDto(GetPresenceQuerySchema) {}

// Type exports
export type ActivityTypeParamsInput = z.infer<typeof ActivityTypeParamsSchema>
export type ActivityDeleteInput = z.infer<typeof ActivityDeleteSchema>
export type ActivityQueryInput = z.infer<typeof ActivityQuerySchema>
export type ActivityRangeInput = z.infer<typeof ActivityRangeSchema>
export type ActivityNotificationInput = z.infer<
  typeof ActivityNotificationSchema
>
export type LikeBodyInput = z.infer<typeof LikeBodySchema>
export type UpdatePresenceInput = z.infer<typeof UpdatePresenceSchema>
export type GetPresenceQueryInput = z.infer<typeof GetPresenceQuerySchema>
