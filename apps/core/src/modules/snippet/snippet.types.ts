import type { EntityId } from '~/shared/id/entity-id'

import type { SnippetType } from './snippet.schema'

export interface SnippetRow {
  id: EntityId
  type: string | null
  private: boolean
  raw: string
  path: string
  comment: string | null
  metatype: string | null
  schema: string | null
  method: string | null
  secret: string | null
  enable: boolean
  builtIn: boolean
  compiledCode: string | null
  createdAt: Date
  updatedAt: Date | null
}

export interface SnippetObjectView {
  id: EntityId
  path: string
  type: string | null
  comment: string | null
  private: boolean
  enable: boolean
  method: string | null
  updatedAt: Date | null
}

export interface SnippetVfsList {
  prefix: string
  objects: SnippetObjectView[]
  commonPrefixes: string[]
}

export interface SkillAssetView {
  path: string
  rawUrl: string
  type: SnippetType | string
  size: number
}

export interface SkillBundleView {
  id: string
  name: string
  description: string
  rawUrl: string
  assets: SkillAssetView[]
}
