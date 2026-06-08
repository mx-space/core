import type {} from '@haklex/rich-editor'
import type { AfilmoryLayout, AfilmorySource } from '@mx-space/editor'
import type { ComponentType } from 'react'

export const AFILMORY_NODE_KEY = 'Afilmory' as const

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
