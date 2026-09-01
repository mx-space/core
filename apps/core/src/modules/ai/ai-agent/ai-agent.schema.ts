import { z } from 'zod'

// --- Conversation CRUD ---

export const CreateConversationSchema = z.object({
  sessionId: z.string().min(1),
  messages: z.array(z.record(z.string(), z.unknown())).default([]),
  model: z.string().min(1).nullish(),
  providerId: z.string().min(1).nullish(),
})
export type CreateConversationDto = z.infer<typeof CreateConversationSchema>

export const AppendMessagesSchema = z.object({
  messages: z.array(z.record(z.string(), z.unknown())).min(1),
})
export type AppendMessagesDto = z.infer<typeof AppendMessagesSchema>

export const ReplaceMessagesSchema = z.object({
  messages: z.array(z.record(z.string(), z.unknown())),
})
export type ReplaceMessagesDto = z.infer<typeof ReplaceMessagesSchema>

export const UpdateConversationSchema = z.object({
  sessionId: z.string().min(1).optional(),
  model: z.string().min(1).nullish(),
  providerId: z.string().min(1).nullish(),
})
export type UpdateConversationDto = z.infer<typeof UpdateConversationSchema>

export const ListConversationsQuerySchema = z.object({
  sessionId: z.string().min(1),
})
export type ListConversationsQueryDto = z.infer<
  typeof ListConversationsQuerySchema
>

// --- Chat Proxy ---

export const ChatProxySchema = z.object({
  model: z.string().min(1),
  providerId: z.string().min(1),
  sessionId: z.string().min(1).max(256),
  messages: z.array(z.record(z.string(), z.unknown())),
  tools: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        parameters: z.record(z.string(), z.unknown()),
      }),
    )
    .optional(),
})
export type ChatProxyDto = z.infer<typeof ChatProxySchema>
