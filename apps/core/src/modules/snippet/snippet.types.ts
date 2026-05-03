import type { EntityId } from '~/shared/id/entity-id'

export interface SnippetRow {
  id: EntityId
  type: string | null
  private: boolean
  raw: string
  name: string
  reference: string
  comment: string | null
  metatype: string | null
  schema: string | null
  method: string | null
  customPath: string | null
  secret: string | null
  enable: boolean
  builtIn: boolean
  compiledCode: string | null
  createdAt: Date
  updatedAt: Date | null
}

export interface SnippetGroupRow {
  reference: string
  count: number
}
