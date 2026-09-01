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

export type RecentlyDto = z.infer<typeof RecentlySchema>

export const RecentlyRefCandidatesQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  size: z.coerce.number().int().min(1).max(20).default(12),
})

export type RecentlyRefCandidatesQueryDto = z.infer<
  typeof RecentlyRefCandidatesQuerySchema
>

export const RecentlyAttitudeSchema = z.object({
  attitude: z.preprocess(
    (val) => (typeof val === 'string' ? Number(val) : val),
    z.enum(RecentlyAttitudeEnum),
  ),
})

export type RecentlyAttitudeDto = z.infer<typeof RecentlyAttitudeSchema>

export type RecentlyInput = z.infer<typeof RecentlySchema>
export type RecentlyAttitudeInput = z.infer<typeof RecentlyAttitudeSchema>
