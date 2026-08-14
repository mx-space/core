import { z } from 'zod'

export const WsInboundEvents = {
  roomJoin: 'room.join',
  roomLeave: 'room.leave',
  sessionUpdate: 'session.update',
  langUpdate: 'lang.update',
  aiAgentJoin: 'ai_agent.join',
  aiAgentLeave: 'ai_agent.leave',
  aiTaskSubscribe: 'ai_task.subscribe',
  aiTaskUnsubscribe: 'ai_task.unsubscribe',
  ping: 'ping',
} as const

export const LANG_PATTERN = /^[a-z]{2}(?:-[A-Za-z]{2,})?$/

export const roomPayloadSchema = z.object({
  room: z.string().min(1).max(128),
})

export const sessionUpdatePayloadSchema = z.object({
  sessionId: z.string().min(1).max(128),
})

export const langUpdatePayloadSchema = z.object({
  lang: z.string().regex(LANG_PATTERN),
})

export const aiAgentPayloadSchema = z.object({
  sessionId: z.string().min(1).max(128),
})

export const aiTaskPayloadSchema = z.object({
  taskId: z.string().min(1).max(128).optional(),
  groupId: z.string().min(1).max(128).optional(),
  all: z.boolean().optional(),
})

export type AiTaskPayload = z.infer<typeof aiTaskPayloadSchema>
