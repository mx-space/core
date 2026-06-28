import { useQuery } from '@tanstack/react-query'

import { API_URL } from '~/constants/env'

import type { BarsResult, Quote, StockKLineInterval } from './types'

function normalizeHost(url: string): string {
  return url.replace(/\/$/, '')
}

export class StockFetchError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'StockFetchError'
    this.status = status
  }
}

export function isStockNotFound(error: unknown): boolean {
  return error instanceof StockFetchError && error.status === 404
}

async function fetchQuote(symbol: string): Promise<Quote> {
  const params = new URLSearchParams({ symbol })
  const res = await fetch(
    `${normalizeHost(API_URL)}/serverless/built-in/stock_quote?${params.toString()}`,
    { headers: { Accept: 'application/json' } },
  )
  if (!res.ok) {
    throw new StockFetchError(
      `Failed to fetch quote (${res.status})`,
      res.status,
    )
  }
  return (await res.json()) as Quote
}

async function fetchBars(args: {
  symbol: string
  from: string
  to: string
  interval: StockKLineInterval
}): Promise<BarsResult> {
  const params = new URLSearchParams({
    symbol: args.symbol,
    from: args.from,
    to: args.to,
    interval: args.interval,
  })
  const res = await fetch(
    `${normalizeHost(API_URL)}/serverless/built-in/stock_bars?${params.toString()}`,
    { headers: { Accept: 'application/json' } },
  )
  if (!res.ok) {
    throw new StockFetchError(
      `Failed to fetch bars (${res.status})`,
      res.status,
    )
  }
  return (await res.json()) as BarsResult
}

export function useStockQuote(symbol: string) {
  return useQuery({
    queryKey: ['stock-quote', symbol],
    queryFn: () => fetchQuote(symbol),
    enabled: Boolean(symbol),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    retry: 1,
  })
}

export function useStockBars(args: {
  symbol: string
  from: string
  to: string
  interval: StockKLineInterval
}) {
  return useQuery({
    queryKey: ['stock-bars', args.symbol, args.from, args.to, args.interval],
    queryFn: () => fetchBars(args),
    enabled: Boolean(args.symbol && args.from && args.to),
    staleTime: 1000 * 60 * 60 * 12,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
    retry: 1,
  })
}
