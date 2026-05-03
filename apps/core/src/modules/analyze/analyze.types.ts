import type { EntityId } from '~/shared/id/entity-id'

export interface AnalyzeRow {
  id: EntityId
  timestamp: Date
  ip: string | null
  ua: Record<string, unknown> | null
  country: string | null
  path: string | null
  referer: string | null
}
