import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export enum SupportedMessageEvent {
  Join = 'join',
  Leave = 'leave',
  UpdateSid = 'updateSid',
}

/**
 * Message event schema
 */
export const MessageEventSchema = z.object({
  type: z.enum(SupportedMessageEvent),
  payload: z.unknown(),
})

export class MessageEventDto extends createZodDto(MessageEventSchema) {}

// Type exports
export type MessageEventInput = z.infer<typeof MessageEventSchema>
