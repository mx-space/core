import type { MxBlockProjection } from '../types'
import { afilmoryBlockProjection } from './afilmory'
import { mapBlockProjection } from './map'

export const mxBlockRegistry = {
  [mapBlockProjection.type]: mapBlockProjection,
  [afilmoryBlockProjection.type]: afilmoryBlockProjection,
} satisfies Record<string, MxBlockProjection<any>>
