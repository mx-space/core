import type { MxBlockProjection } from '../types'
import { serializeLiteXmlFallbackNode } from './litexml'

export type MapTrackPointTuple =
  [number, number] | [number, number, number | null]

export interface MapTrackStop {
  durationSec: number
  lat: number
  lon: number
  time?: string
  visits?: number
}

export interface MapTrackBounds {
  diagonalMeters?: number
  maxLat: number
  maxLon: number
  minLat: number
  minLon: number
}

export interface MapTrackLeg {
  distanceMeters?: number
  endTimeMs?: number
  segments: [from: number, to: number]
  startTimeMs?: number
  title: string
}

export interface MapTrackData {
  bounds?: MapTrackBounds
  distanceMeters?: number
  endTimeMs?: number
  legs?: MapTrackLeg[]
  originalCount?: number
  points: MapTrackPointTuple[]
  sampledCount?: number
  segments?: MapTrackPointTuple[][]
  startTimeMs?: number
  stops?: MapTrackStop[]
  timezoneOffsetMinutes?: number
  title?: string
  version?: number
}

export interface MapMerchant {
  address?: string
  phone?: string
  website?: string
  openingHours?: string
  category?: string
  priceRange?: string
  socialHandles?: { instagram?: string; twitter?: string }
  tags?: string[]
}

export interface MapPoi {
  description?: string
  icon?: 'pin'
  lat: number
  lon: number
  title?: string
  merchant?: MapMerchant
}

export interface MapView {
  center?: [number, number]
  zoom?: number
}

export interface MapBlockProps {
  className?: string
  height?: number
  interactive?: boolean
  pois?: MapPoi[]
  src?: string
  title?: string
  track?: MapTrackData
  view?: MapView
}

export interface SerializedMapNode {
  $?: {
    blockId?: unknown
  }
  type: 'map'
  version?: number
  title?: string
  pois?: MapPoi[]
  track?: { url?: string }
  view?: MapView
}

export const mapBlockProjection: MxBlockProjection<SerializedMapNode> = {
  type: 'map',
  toMarkdown(node) {
    return serializeLiteXmlFallbackNode(node)
  },
}
