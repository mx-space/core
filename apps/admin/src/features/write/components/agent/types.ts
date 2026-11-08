import type { CapturedSelection, ChatBubble } from '@haklex/rich-agent-core'

import type { AgentTurnUsage } from './agent-usage'

export type ChatAttachment =
  | { kind: 'image'; name: string; url: string }
  | { kind: 'file'; name: string; size?: number }

export type UserChatBubble = Extract<ChatBubble, { type: 'user' }> & {
  attachments?: ChatAttachment[]
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
