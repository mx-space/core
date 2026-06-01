import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

// --- Conversation CRUD ---

export const CreateConversationSchema = z.object({
  sessionId: z.string().min(1),
  messages: z.array(z.record(z.string(), z.unknown())).default([]),
  model: z.string().min(1).nullish(),
  providerId: z.string().min(1).nullish(),
})
export class CreateConversationDto extends createZodDto(
  CreateConversationSchema,
) {}

export const ReplaceMessagesSchema = z.object({
  messages: z.array(z.record(z.string(), z.unknown())),
})
export class ReplaceMessagesDto extends createZodDto(ReplaceMessagesSchema) {}

export const UpdateConversationSchema = z.object({
  sessionId: z.string().min(1).optional(),
  model: z.string().min(1).nullish(),
  providerId: z.string().min(1).nullish(),
})
export class UpdateConversationDto extends createZodDto(
  UpdateConversationSchema,
) {}

export const ListConversationsQuerySchema = z.object({
  sessionId: z.string().min(1),
})
export class ListConversationsQueryDto extends createZodDto(
  ListConversationsQuerySchema,
) {}

export const GenerateTitleSchema = z.object({
  messages: z.array(z.record(z.string(), z.unknown())).optional(),
  model: z.string().min(1).nullish(),
  providerId: z.string().min(1).nullish(),
})
export class GenerateTitleDto extends createZodDto(GenerateTitleSchema) {}

// --- Chat Proxy ---

export const ChatProxySchema = z.object({
  model: z.string().min(1),
  providerId: z.string().min(1),
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
export class ChatProxyDto extends createZodDto(ChatProxySchema) {}
