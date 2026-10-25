import { z } from 'zod'

import { zEntityId } from '~/common/zod'

import { CLEANUP_CATEGORIES, DraftRefType } from './draft.enum'

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

export const OrganizerPreviewQuerySchema = z.object({
  olderThanDays: z.coerce.number().int().min(0).max(3650).default(90),
  refType: z.enum(DraftRefType).optional(),
  search: z.string().trim().max(200).optional(),
})

export type OrganizerPreviewQueryDto = z.infer<
  typeof OrganizerPreviewQuerySchema
>

export const OrganizeDraftsSchema = z
  .object({
    discardChanges: z.boolean().default(false),
    items: z
      .array(
        z.object({
          documentId: zEntityId,
          version: z.string().regex(/^[\da-f]{32}$/),
        }),
      )
      .min(1)
      .max(100),
  })
  .refine(
    (input) =>
      new Set(input.items.map((item) => item.documentId)).size ===
      input.items.length,
    {
      message: 'Duplicate documents are not allowed',
      path: ['items'],
    },
  )

export type OrganizeDraftsDto = z.infer<typeof OrganizeDraftsSchema>

export const OrganizerPreviewView = z.array(
  z.object({
    bytes: z.number(),
    documentId: z.string(),
    draftCount: z.number(),
    hasChanges: z.boolean(),
    lastEditedAt: z.date(),
    refType: z.enum(DraftRefType),
    revisionCount: z.number(),
    title: z.string(),
    version: z.string(),
  }),
)

export const OrganizerResultView = z.object({
  organized: z.number(),
  freed: z.object({
    bytes: z.number(),
    drafts: z.number(),
    revisions: z.number(),
    crdtDocs: z.number(),
  }),
  skipped: z.array(
    z.object({
      documentId: z.string(),
      title: z.string(),
      reason: z.enum([
        'changed',
        'editing',
        'publishing',
        'unconfirmed',
        'failed',
      ]),
    }),
  ),
})
