import type {} from '@haklex/rich-editor'
import type { ComponentType } from 'react'

import type { MapPoi, MapView } from './types'

export const MAP_NODE_KEY = 'Map' as const

export interface MapSlotProps {
  nodeKey?: string
  pois?: MapPoi[]
  title?: string
  track?: { url: string }
  view?: MapView
}

declare module '@haklex/rich-editor' {
  interface RendererConfig {
    Map?: ComponentType<MapSlotProps>
  }
}
