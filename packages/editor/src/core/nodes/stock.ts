import type { MxBlockProjection } from '../types'
import { serializeLiteXmlFallbackNode } from './litexml'

export type StockVariant = 'snapshot' | 'kline'

export type StockKLineInterval = '5m' | '15m' | '1h' | '1d'

export interface StockKLineRange {
  from: string
  interval: StockKLineInterval
  to: string
}

export type StockNodePayload =
  | {
      variant: 'snapshot'
      symbol: string
    }
  | {
      variant: 'kline'
      symbol: string
      range: StockKLineRange
      ema?: [number, number] | false
    }

export interface SerializedStockNode {
  $?: {
    blockId?: unknown
  }
  type: 'stock'
  version?: number
  variant: StockVariant
  symbol: string
  range?: StockKLineRange
  ema?: [number, number] | false
}

export const stockBlockProjection: MxBlockProjection<SerializedStockNode> = {
  type: 'stock',
  toMarkdown(node) {
    return serializeLiteXmlFallbackNode(node)
  },
}
