import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import { zEntityId } from '~/common/zod'

export enum RecentlyAttitudeEnum {
  Up,
  Down,
}

export enum RecentlyTypeEnum {
  Text = 'text',
  Link = 'link',
}

export const RecentlySchema = z.object({
  content: z.string().min(1),
  ref: zEntityId.optional(),
  refType: z.string().optional(),
})

export class RecentlyDto extends createZodDto(RecentlySchema) {}

export const RecentlyAttitudeSchema = z.object({
  attitude: z.preprocess(
    (val) => (typeof val === 'string' ? Number(val) : val),
    z.enum(RecentlyAttitudeEnum),
  ),
})

export class RecentlyAttitudeDto extends createZodDto(RecentlyAttitudeSchema) {}

export type RecentlyInput = z.infer<typeof RecentlySchema>
export type RecentlyAttitudeInput = z.infer<typeof RecentlyAttitudeSchema>
