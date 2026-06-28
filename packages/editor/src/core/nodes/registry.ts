import type { MxBlockProjection } from '../types'
import { afilmoryBlockProjection } from './afilmory'
import { mapBlockProjection } from './map'
import { stockBlockProjection } from './stock'

export const mxBlockRegistry = {
  [mapBlockProjection.type]: mapBlockProjection,
  [afilmoryBlockProjection.type]: afilmoryBlockProjection,
  [stockBlockProjection.type]: stockBlockProjection,
} satisfies Record<string, MxBlockProjection<any>>
