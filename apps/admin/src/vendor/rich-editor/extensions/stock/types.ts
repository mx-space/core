export type { StockKLineInterval } from '@mx-space/editor'

export type MarketState = 'pre' | 'regular' | 'post' | 'closed'

export type Bar = {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

export type StockMeta = {
  symbol: string
  exchange?: string
  longName?: string
  shortName?: string
  currency?: string
  regularMarketPrice?: number
  chartPreviousClose?: number
  fiftyTwoWeekHigh?: number
  fiftyTwoWeekLow?: number
  regularMarketDayHigh?: number
  regularMarketDayLow?: number
  regularMarketVolume?: number
  timezone?: string
  asOf?: number
}

export type BarsResult = {
  meta: StockMeta
  bars: Bar[]
}

export type SparklinePoint = {
  timestamp: number
  close: number
}

export type Quote = {
  symbol: string
  exchange?: string
  longName?: string
  shortName?: string
  currency: string
  price: number
  previousClose: number
  dayHigh: number
  dayLow: number
  fiftyTwoWeekHigh: number
  fiftyTwoWeekLow: number
  volume: number
  sparkline: SparklinePoint[]
  asOf: number
  marketState: MarketState
}
