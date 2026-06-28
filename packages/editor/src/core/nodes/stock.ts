import type { MxBlockProjection } from '../types'
import { serializeLiteXmlFallbackNode } from './litexml'

export type StockVariant = 'snapshot' | 'kline'

export type StockKLineRange = {
  interval: string
  from?: string
  to?: string
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
