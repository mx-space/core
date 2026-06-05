import type {} from '@haklex/rich-editor'
import type { ComponentType } from 'react'

export const AFILMORY_NODE_KEY = 'Afilmory' as const

export interface AfilmoryFilter {
  tags?: string[]
  tagMode?: 'union' | 'intersection'
  cameras?: string[]
  lenses?: string[]
  dateFrom?: string
  dateTo?: string
  search?: string
}

export type AfilmorySource =
  | { kind: 'list'; ids: string[] }
  | { kind: 'filter'; filter: AfilmoryFilter }

export type AfilmoryLayout = 'grid' | 'masonry' | 'carousel'

export interface AfilmorySlotProps {
  nodeKey?: string
  baseUrl: string
  source: AfilmorySource
  layout?: AfilmoryLayout
  title?: string
  caption?: string
  alt?: string
  accent?: string
  limit?: number
}

declare module '@haklex/rich-editor' {
  interface RendererConfig {
    Afilmory?: ComponentType<AfilmorySlotProps>
  }
}

export {}
