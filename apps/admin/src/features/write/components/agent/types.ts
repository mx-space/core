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

export interface AssistantTextBlock {
  contentIndex: number
  kind: 'text'
  text: string
  status: 'streaming' | 'done'
}

export interface AssistantThinkingBlock {
  contentIndex: number
  kind: 'thinking'
  text: string
  status: 'streaming' | 'done'
  startedAt: number
  endedAt?: number
}

export interface AssistantToolCallBlock {
  contentIndex: number
  kind: 'toolcall'
  toolName: string
  partialArgs: Record<string, unknown>
  finalArgs?: Record<string, unknown>
  toolCallId?: string
  status: 'streaming' | 'done'
}

export type AssistantBlock =
  | AssistantTextBlock
  | AssistantThinkingBlock
  | AssistantToolCallBlock

export interface UserChatMessage {
  id: string
  role: 'user'
  text: string
}

export interface AssistantChatMessage {
  id: string
  role: 'assistant'
  blocks: AssistantBlock[]
}

export interface ErrorChatMessage {
  id: string
  role: 'error'
  message: string
}

export type ChatMessageEntry =
  | UserChatMessage
  | AssistantChatMessage
  | ErrorChatMessage

export type AgentStreamStatus =
  | 'idle'
  | 'connecting'
  | 'streaming'
  | 'connection_lost'
  | 'error'

export interface AgentToolCallFinal {
  id: string
  name: string
  arguments: Record<string, unknown>
}
