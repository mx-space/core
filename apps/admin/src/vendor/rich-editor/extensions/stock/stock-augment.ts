import type {} from '@haklex/rich-editor'
import type { ComponentType } from 'react'

import type { StockKLineInterval } from './types'

export const STOCK_NODE_KEY = 'Stock' as const

export type StockVariant = 'snapshot' | 'kline'

export interface StockKLineRange {
  from: string
  interval: StockKLineInterval
  to: string
}

export interface StockSlotProps {
  ema?: [number, number] | false
  nodeKey?: string
  range?: StockKLineRange
  symbol: string
  variant: StockVariant
}

declare module '@haklex/rich-editor' {
  interface RendererConfig {
    Stock?: ComponentType<StockSlotProps>
  }
}
