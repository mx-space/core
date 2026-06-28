import { useMemo } from 'react'

import { useI18n } from '~/i18n'

import {
  DOWN_FILL,
  MONO,
  PaperCardChrome,
  StockFooter,
  StockHeader,
  UP_STROKE,
} from './_shared'
import type { Quote, SparklinePoint, StockMeta } from './types'
import { isStockNotFound, useStockQuote } from './use-stock-data'

const SPARK_W = 220
const SPARK_H = 56
const SPARK_PAD = 4

function buildSparkPath(points: SparklinePoint[]): string {
  if (points.length === 0) return ''
  const closes = points.map((p) => p.close)
  const min = Math.min(...closes)
  const max = Math.max(...closes)
  const range = max - min || 1
  const innerH = SPARK_H - SPARK_PAD * 2
  const xs = points.map((_, i) =>
    points.length > 1 ? (i / (points.length - 1)) * SPARK_W : SPARK_W / 2,
  )
  const ys = closes.map(
    (c) => SPARK_H - SPARK_PAD - ((c - min) / range) * innerH,
  )
  const pts = xs.map((x, i) => ({ x, y: ys[i]! }))
  if (pts.length === 1) {
    return `M ${pts[0]!.x.toFixed(2)} ${pts[0]!.y.toFixed(2)}`
  }
  const segs: string[] = [`M ${pts[0]!.x.toFixed(2)} ${pts[0]!.y.toFixed(2)}`]
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!
    const p1 = pts[i]!
    const p2 = pts[i + 1]!
    const p3 = pts[i + 2] ?? p2
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    segs.push(
      `C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    )
  }
  return segs.join(' ')
}

function Unavailable({
  symbol,
  message,
  onRetry,
}: {
  symbol: string
  message: string
  onRetry?: () => void
}) {
  return (
    <PaperCardChrome>
      <header className="mb-4">
        <div
          className="text-fg-muted text-[11px] tracking-[0.1em] uppercase"
          style={{ fontFamily: MONO }}
        >
          {symbol}
        </div>
      </header>
      <p className="text-fg-muted text-[13px]">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="text-fg-muted hover:text-fg border-border hover:border-border-strong mt-3 rounded-sm border px-2 py-1 text-[11px] transition-colors"
        >
          Retry
        </button>
      ) : null}
    </PaperCardChrome>
  )
}

function SnapshotCard({ quote, locale }: { quote: Quote; locale: string }) {
  const nf = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [locale],
  )
  const tf = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        month: 'short',
        day: 'numeric',
      }),
    [locale],
  )

  const deltaAbs = quote.price - quote.previousClose
  const deltaPctAbs =
    quote.previousClose > 0 ? (deltaAbs / quote.previousClose) * 100 : 0
  const isUp = deltaAbs >= 0
  const displayPrice = nf.format(quote.price)
  const delta = nf.format(deltaAbs)
  const deltaPct = nf.format(deltaPctAbs)

  const meta: StockMeta = {
    symbol: quote.symbol,
    exchange: quote.exchange,
    longName: quote.longName,
    shortName: quote.shortName,
    currency: quote.currency,
  }

  const firstClose = quote.sparkline[0]?.close ?? 0
  const lastClose = quote.sparkline.at(-1)?.close ?? firstClose
  const strokeColor = lastClose >= firstClose ? UP_STROKE : DOWN_FILL
  const sparkPath = buildSparkPath(quote.sparkline)
  const asOfText = tf.format(new Date(quote.asOf * 1000))

  return (
    <PaperCardChrome>
      <StockHeader
        delta={delta}
        deltaPct={deltaPct}
        displayPrice={displayPrice}
        isUp={isUp}
        meta={meta}
      />
      <svg
        aria-hidden="true"
        height={SPARK_H}
        viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
        width={SPARK_W}
        xmlns="http://www.w3.org/2000/svg"
      >
        {sparkPath ? (
          <path
            d={sparkPath}
            fill="none"
            opacity={0.85}
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.4}
          />
        ) : null}
      </svg>
      <StockFooter left="Today · intraday" right={asOfText} />
    </PaperCardChrome>
  )
}

export function StockSnapshotView({ symbol }: { symbol: string }) {
  const { locale } = useI18n()
  const { data, isLoading, isError, error, refetch } = useStockQuote(symbol)

  if (isLoading) {
    return <Unavailable message="Loading quote…" symbol={symbol} />
  }
  if (isError || !data) {
    const notFound = isStockNotFound(error)
    return (
      <Unavailable
        message={notFound ? 'Symbol not found' : 'Failed to load quote'}
        symbol={symbol}
        onRetry={notFound ? undefined : () => void refetch()}
      />
    )
  }
  return <SnapshotCard locale={locale} quote={data} />
}
