import { z } from 'zod'

import { zEntityId } from '~/common/zod'

import { DraftRefType } from './draft.enum'
import { CLEANUP_CATEGORIES } from './draft-cleanup.service'

const zDays = z.coerce.number().int().min(1).max(3650)

export const StorageQuerySchema = z.object({
  refType: z.enum(DraftRefType).optional(),
})

export type StorageQueryDto = z.infer<typeof StorageQuerySchema>

export const CleanupPreviewQuerySchema = z.object({
  olderThanDays: zDays.default(30),
})

export type CleanupPreviewQueryDto = z.infer<typeof CleanupPreviewQuerySchema>

export const CleanupRunSchema = z.object({
  archivedDraftIds: z.array(zEntityId).max(500).optional(),
  categories: z
    .array(z.enum(CLEANUP_CATEGORIES))
    .max(CLEANUP_CATEGORIES.length),
  olderThanDays: zDays,
})

export type CleanupRunDto = z.infer<typeof CleanupRunSchema>

export const BatchDeleteDraftsSchema = z.object({
  ids: z.array(zEntityId).min(1).max(200),
})

export type BatchDeleteDraftsDto = z.infer<typeof BatchDeleteDraftsSchema>
