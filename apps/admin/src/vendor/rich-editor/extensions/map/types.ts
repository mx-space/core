export type MapTrackPointTuple =
  | [number, number]
  | [number, number, number | null]

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

export interface MapTrackData {
  bounds?: MapTrackBounds
  distanceMeters?: number
  endTimeMs?: number
  originalCount?: number
  points: MapTrackPointTuple[]
  sampledCount?: number
  startTimeMs?: number
  stops?: MapTrackStop[]
  timezoneOffsetMinutes?: number
  title?: string
  version?: number
}

export interface MapPoi {
  description?: string
  icon?: 'pin'
  lat: number
  lon: number
  title?: string
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
