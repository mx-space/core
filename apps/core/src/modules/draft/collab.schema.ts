import { z } from 'zod'

import { zEntityId } from '~/common/zod'

export const CollabDocumentParamsSchema = z.object({
  documentId: zEntityId,
})
export type CollabDocumentParamsDto = z.infer<typeof CollabDocumentParamsSchema>

export const CollabInviteParamsSchema = CollabDocumentParamsSchema.extend({
  inviteId: zEntityId,
})
export type CollabInviteParamsDto = z.infer<typeof CollabInviteParamsSchema>

export const CollabCollaboratorParamsSchema = CollabDocumentParamsSchema.extend(
  { readerId: z.string().min(1).max(64) },
)
export type CollabCollaboratorParamsDto = z.infer<
  typeof CollabCollaboratorParamsSchema
>

export const CollabTokenParamsSchema = z.object({
  token: z.string().min(16).max(128),
})
export type CollabTokenParamsDto = z.infer<typeof CollabTokenParamsSchema>

export const CreateCollabInviteSchema = z.object({
  expiresInDays: z.number().int().min(1).max(30).optional(),
  maxUses: z.number().int().min(1).max(100).nullable().optional(),
})
export type CreateCollabInviteDto = z.infer<typeof CreateCollabInviteSchema>

export const UpdateCollaboratorSchema = z.object({
  showInByline: z.boolean(),
})
export type UpdateCollaboratorDto = z.infer<typeof UpdateCollaboratorSchema>

export const CollabCrdtQuerySchema = z.object({
  since: z.string().max(65_536).optional(),
})
export type CollabCrdtQueryDto = z.infer<typeof CollabCrdtQuerySchema>
