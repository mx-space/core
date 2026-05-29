import type { EntityId } from '~/shared/id/entity-id'

export interface AiAgentConversationRow {
  id: EntityId
  sessionId: string
  model: string | null
  providerId: string | null
  messages: unknown[]
  createdAt: Date
  updatedAt: Date | null
}
