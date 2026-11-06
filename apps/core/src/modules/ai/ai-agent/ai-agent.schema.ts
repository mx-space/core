import { z } from 'zod'

export const UpdateConversationSchema = z.object({
  sessionId: z.string().min(1).optional(),
})
export type UpdateConversationDto = z.infer<typeof UpdateConversationSchema>

export const ListConversationsQuerySchema = z.object({
  sessionId: z.string().min(1),
})
export type ListConversationsQueryDto = z.infer<
  typeof ListConversationsQuerySchema
>

export const SaveReviewStateSchema = z.object({
  reviewState: z.record(z.string(), z.unknown()).nullable(),
  anchors: z.array(
    z.object({ batchId: z.string().min(1), toolCallId: z.string().min(1) }),
  ),
})
export type SaveReviewStateDto = z.infer<typeof SaveReviewStateSchema>
