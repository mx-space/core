import type { CapturedSelection, ChatBubble } from '@haklex/rich-agent-core'

import type { AgentTurnUsage } from './agent-usage'

export type UserChatBubble = Extract<ChatBubble, { type: 'user' }> & {
  selection?: CapturedSelection
}

export type AssistantChatBubble = Extract<ChatBubble, { type: 'assistant' }> & {
  usage?: AgentTurnUsage
}

export interface SelectedAgentModel {
  modelId: string
  providerId: string
  providerType: string
}

export interface AgentConversationMessage {
  [key: string]: unknown
}

export interface AgentConversation {
  createdAt: string
  id: string
  messages?: AgentConversationMessage[]
  model: string | null
  providerId: string | null
  sessionId: string
  updatedAt: string
}
