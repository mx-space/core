import type { EntityId } from '~/shared/id/entity-id'

export interface AiAgentConversationRow {
  id: EntityId
  sessionId: string
  model: string
  providerId: string
  title: string | null
  createdAt: Date
  updatedAt: Date | null
}

export interface AiAgentConversationDetailRow extends AiAgentConversationRow {
  transcript: Record<string, unknown>
  reviewState: Record<string, unknown> | null
}
