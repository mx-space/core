import { AIProviderType } from '~/modules/ai/ai.types'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { BUILTIN_AGENT_TOOL_IDS } from './ai-agent.types'

const AgentProviderSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.nativeEnum(AIProviderType),
  apiKey: z.string().min(1),
  endpoint: z.string().url().optional().or(z.literal('')),
  defaultModel: z.string().min(1),
  enabled: z.boolean(),
})

const AgentModelAssignmentSchema = z.object({
  providerId: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
})

export const UpsertAIAgentConfigSchema = z.object({
  providers: z.array(AgentProviderSchema),
  agentModel: AgentModelAssignmentSchema.optional(),
  enabledTools: z.array(z.enum(BUILTIN_AGENT_TOOL_IDS)).optional(),
})

export class UpsertAIAgentConfigDto extends createZodDto(
  UpsertAIAgentConfigSchema,
) {}

export const CreateAIAgentSessionSchema = z.object({
  title: z.string().min(1).max(120).optional(),
})

export class CreateAIAgentSessionDto extends createZodDto(
  CreateAIAgentSessionSchema,
) {}

export const SendAIAgentMessageSchema = z.object({
  content: z.string().trim().min(1).max(20_000),
})

export class SendAIAgentMessageDto extends createZodDto(
  SendAIAgentMessageSchema,
) {}

export const GetAIAgentMessagesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  size: z.coerce.number().int().min(1).max(100).default(50),
})

export class GetAIAgentMessagesQueryDto extends createZodDto(
  GetAIAgentMessagesQuerySchema,
) {}

export type UpsertAIAgentConfigInput = z.infer<typeof UpsertAIAgentConfigSchema>
export type SendAIAgentMessageInput = z.infer<typeof SendAIAgentMessageSchema>
export type CreateAIAgentSessionInput = z.infer<
  typeof CreateAIAgentSessionSchema
>
export type GetAIAgentMessagesQueryInput = z.infer<
  typeof GetAIAgentMessagesQuerySchema
>
