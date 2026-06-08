import type { MxBlockProjection } from '../types'
import { serializeLiteXmlFallbackNode } from './litexml'

export interface AfilmoryFilter {
  tags?: string[]
  tagMode?: 'union' | 'intersection'
  cameras?: string[]
  lenses?: string[]
  dateFrom?: string
  dateTo?: string
  search?: string
}

export type AfilmoryListItem = {
  id: string
  w: number
  h: number
  hash?: string
}

export type AfilmorySource =
  | { kind: 'list'; items: AfilmoryListItem[] }
  | { kind: 'filter'; filter: AfilmoryFilter }

export type AfilmoryLayout = 'grid' | 'masonry' | 'carousel'

export interface AfilmoryBlockProps {
  baseUrl: string
  source: AfilmorySource
  layout?: AfilmoryLayout
  title?: string
  caption?: string
  alt?: string
  accent?: string
  limit?: number
}

export interface SerializedAfilmoryNode {
  $?: {
    blockId?: unknown
  }
  type: 'afilmory'
  version?: number
  baseUrl?: string
  source?: AfilmorySource
  title?: string
  caption?: string
  alt?: string
  accent?: string
  layout?: AfilmoryLayout
  limit?: number
}

export const afilmoryBlockProjection: MxBlockProjection<SerializedAfilmoryNode> =
  {
    type: 'afilmory',
    toMarkdown(node) {
      return serializeLiteXmlFallbackNode(node)
    },
  }
