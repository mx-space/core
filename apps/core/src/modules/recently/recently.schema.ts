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

export const RecentlyRefTypeSchema = z.enum([
  'post',
  'note',
  'page',
  'recently',
])

export const RecentlyMetadataSchema = z
  .object({
    selectedEnrichmentUrls: z.array(z.string().url()).optional(),
  })
  .passthrough()

export const RecentlySchema = z.object({
  content: z.string().min(1),
  ref: zEntityId.nullable().optional(),
  refType: RecentlyRefTypeSchema.nullable().optional(),
  clearRef: z.boolean().optional(),
  metadata: RecentlyMetadataSchema.nullable().optional(),
})

export class RecentlyDto extends createZodDto(RecentlySchema) {}

export const RecentlyRefCandidatesQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  size: z.coerce.number().int().min(1).max(20).default(12),
})

export class RecentlyRefCandidatesQueryDto extends createZodDto(
  RecentlyRefCandidatesQuerySchema,
) {}

export const RecentlyAttitudeSchema = z.object({
  attitude: z.preprocess(
    (val) => (typeof val === 'string' ? Number(val) : val),
    z.enum(RecentlyAttitudeEnum),
  ),
})

export class RecentlyAttitudeDto extends createZodDto(RecentlyAttitudeSchema) {}

export type RecentlyInput = z.infer<typeof RecentlySchema>
export type RecentlyAttitudeInput = z.infer<typeof RecentlyAttitudeSchema>
