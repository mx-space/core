import type { EntityId } from '~/shared/id/entity-id'

export type AiMemoryType =
  | 'fact'
  | 'event'
  | 'preference'
  | 'thread'
  | 'pattern'

export type AiMemoryStatus =
  | 'active'
  | 'superseded'
  | 'archived'
  | 'pending_review'

export interface AiMemorySource {
  kind?: string
  authorId?: string
  [key: string]: unknown
}

export interface AiMemory {
  id: EntityId
  scope: string
  type: AiMemoryType
  content: string
  confidence: number
  salience: number
  source: AiMemorySource
  embedding: number[] | null
  embeddingModel: string | null
  dim: number | null
  firstSeenAt: Date
  lastSeenAt: Date
  expiresAt: Date | null
  supersedesId: EntityId | null
  status: AiMemoryStatus
  metadata: Record<string, unknown>
  createdAt: Date
  updatedAt: Date | null
}

export interface RecallOptions {
  scope: string | string[]
  query?: string
  topK?: number
  minSimilarity?: number
}

export interface RecallScoredMemory extends AiMemory {
  similarity?: number
  score?: number
}
