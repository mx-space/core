import type { EntityId } from '~/shared/id/entity-id'

export interface AiAgentConversationRow {
  id: EntityId
  refId: EntityId
  refType: string
  title: string | null
  messages: unknown[]
  model: string
  providerId: string
  reviewState: Record<string, unknown> | null
  diffState: Record<string, unknown> | null
  messageCount: number
  createdAt: Date
  updatedAt: Date | null
}
