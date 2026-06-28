import type {} from '@haklex/rich-editor'
import type { StockKLineRange, StockVariant } from '@mx-space/editor'
import type { ComponentType } from 'react'

export { type StockKLineRange, type StockVariant } from '@mx-space/editor'

export const STOCK_NODE_KEY = 'Stock' as const

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
