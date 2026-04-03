import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import { zMongoId } from '~/common/zod'

// --- Conversation CRUD ---

export const CreateConversationSchema = z.object({
  refId: zMongoId,
  refType: z.enum(['post', 'note', 'page']),
  title: z.string().optional(),
  messages: z.array(z.record(z.unknown())).default([]),
  model: z.string().min(1),
  providerId: z.string().min(1),
})
export class CreateConversationDto extends createZodDto(
  CreateConversationSchema,
) {}

export const AppendMessagesSchema = z.object({
  messages: z.array(z.record(z.unknown())).min(1),
})
export class AppendMessagesDto extends createZodDto(AppendMessagesSchema) {}

export const ListConversationsQuerySchema = z.object({
  refId: zMongoId,
  refType: z.enum(['post', 'note', 'page']),
})
export class ListConversationsQueryDto extends createZodDto(
  ListConversationsQuerySchema,
) {}

// --- Chat Proxy ---

export const ChatProxySchema = z.object({
  model: z.string().min(1),
  providerId: z.string().min(1),
  messages: z.array(z.record(z.unknown())),
  tools: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        parameters: z.record(z.unknown()),
      }),
    )
    .optional(),
})
export class ChatProxyDto extends createZodDto(ChatProxySchema) {}
