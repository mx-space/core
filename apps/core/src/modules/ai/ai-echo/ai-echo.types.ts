import type { EntityId } from '~/shared/id/entity-id'

export type AiEchoStatus =
  | 'pending'
  | 'generating'
  | 'ready'
  | 'edited'
  | 'failed'
  | 'archived'

export interface AiEchoMetadata {
  taskId?: string
  retrievalIds?: string[]
  retrievalSimilarities?: number[]
  memoryIds?: string[]
  profileRefreshedAt?: string | null
  errorCode?: string
  upstreamMessage?: string
  aborted?: boolean
  [key: string]: unknown
}

export interface AiEcho {
  id: EntityId
  scenarioKey: string
  subjectType: string
  subjectId: EntityId
  personaKey: string
  content: string | null
  status: AiEchoStatus
  model: string | null
  metadata: AiEchoMetadata
  generatedAt: Date | null
  editedAt: Date | null
  editedBy: EntityId | null
  createdAt: Date
  updatedAt: Date | null
}

export interface AiEchoCreateInput {
  scenarioKey: string
  subjectType: string
  subjectId: string
  personaKey: string
  status: AiEchoStatus
  metadata?: AiEchoMetadata
}

export interface AiEchoUpdateInput {
  status?: AiEchoStatus
  content?: string | null
  model?: string | null
  metadata?: AiEchoMetadata
  generatedAt?: Date | null
  editedAt?: Date | null
  editedBy?: string | null
}

export interface AiEchoListFilters {
  scenarioKey?: string
  status?: AiEchoStatus
  personaKey?: string
  subjectType?: string
}
