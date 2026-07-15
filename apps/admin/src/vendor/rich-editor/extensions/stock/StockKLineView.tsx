import type { Chart, DeepPartial, Styles } from 'klinecharts'
import { useEffect, useMemo, useRef, useState } from 'react'

import { useI18n } from '~/i18n'
import { useThemeMode } from '~/theme'

import {
  DOWN_FILL,
  EMA_FAST,
  EMA_SLOW,
  MONO,
  PaperCardChrome,
  StockFooter,
  StockHeader,
  UP_STROKE,
} from './_shared'
import type { Bar, StockKLineInterval, StockMeta } from './types'
import { isStockNotFound, useStockBars } from './use-stock-data'

type Props = {
  symbol: string
  range: {
    from: string
    to: string
    interval: StockKLineInterval
  }
  ema?: [number, number] | false
}

type ThemeColors = {
  fg1: string
  fg2: string
  fg3: string
  fg4: string
  axisTick: string
  crosshairLine: string
  crosshairTextBg: string
  crosshairTextFg: string
  tooltipTitle: string
  tooltipLegend: string
}

const LIGHT_COLORS: ThemeColors = {
  fg1: 'rgba(0,0,0,0.92)',
  fg2: 'rgba(0,0,0,0.62)',
  fg3: 'rgba(0,0,0,0.42)',
  fg4: 'rgba(0,0,0,0.28)',
  axisTick: 'rgba(0,0,0,0.36)',
  crosshairLine: 'rgba(0,0,0,0.22)',
  crosshairTextBg: 'rgba(0,0,0,0.72)',
  crosshairTextFg: '#fff',
  tooltipTitle: 'rgba(0,0,0,0.55)',
  tooltipLegend: 'rgba(0,0,0,0.78)',
}

const DARK_COLORS: ThemeColors = {
  fg1: 'rgba(255,255,255,0.92)',
  fg2: 'rgba(255,255,255,0.62)',
  fg3: 'rgba(255,255,255,0.42)',
  fg4: 'rgba(255,255,255,0.32)',
  axisTick: 'rgba(255,255,255,0.46)',
  crosshairLine: 'rgba(255,255,255,0.28)',
  crosshairTextBg: 'rgba(255,255,255,0.78)',
  crosshairTextFg: '#1a1a1a',
  tooltipTitle: 'rgba(255,255,255,0.6)',
  tooltipLegend: 'rgba(255,255,255,0.84)',
}

function buildStyles(c: ThemeColors): DeepPartial<Styles> {
  return {
    grid: { show: false },
    candle: {
      type: 'candle_up_stroke',
      bar: {
        compareRule: 'current_open',
        upColor: 'transparent',
        downColor: DOWN_FILL,
        noChangeColor: '#999',
        upBorderColor: UP_STROKE,
        downBorderColor: DOWN_FILL,
        noChangeBorderColor: '#999',
        upWickColor: UP_STROKE,
        downWickColor: DOWN_FILL,
        noChangeWickColor: '#999',
      },
      priceMark: {
        show: true,
        high: {
          show: true,
          color: c.fg4,
          textOffset: 5,
          textSize: 10,
          textFamily: MONO,
          textWeight: 'normal',
        },
        low: {
          show: true,
          color: c.fg4,
          textOffset: 5,
          textSize: 10,
          textFamily: MONO,
          textWeight: 'normal',
        },
        last: { show: false },
      },
      tooltip: {
        showRule: 'follow_cross',
        showType: 'standard',
        title: {
          show: true,
          size: 11,
          family: MONO,
          color: c.tooltipTitle,
          weight: 'normal',
        },
        legend: {
          size: 11,
          family: MONO,
          color: c.tooltipLegend,
          weight: 'normal',
          template: [
            { title: 'O', value: '{open}' },
            { title: 'H', value: '{high}' },
            { title: 'L', value: '{low}' },
            { title: 'C', value: '{close}' },
          ],
        },
      },
    },
    xAxis: {
      show: true,
      size: 22,
      axisLine: { show: false },
      tickLine: { show: false },
      tickText: {
        show: true,
        color: c.axisTick,
        size: 10,
        family: MONO,
        weight: 'normal',
        marginStart: 4,
        marginEnd: 4,
      },
    },
    yAxis: {
      show: true,
      size: 'auto',
      axisLine: { show: false },
      tickLine: { show: false },
      tickText: {
        show: true,
        color: c.axisTick,
        size: 10,
        family: MONO,
        weight: 'normal',
        marginStart: 6,
        marginEnd: 6,
      },
    },
    crosshair: {
      show: true,
      horizontal: {
        show: true,
        line: {
          show: true,
          style: 'dashed',
          dashedValue: [2, 3],
          size: 1,
          color: c.crosshairLine,
        },
        text: {
          show: true,
          style: 'fill',
          color: c.crosshairTextFg,
          size: 10,
          family: MONO,
          weight: 'normal',
          paddingLeft: 4,
          paddingTop: 2,
          paddingRight: 4,
          paddingBottom: 2,
          borderStyle: 'solid',
          borderDashedValue: [2, 2],
          borderSize: 0,
          borderColor: 'transparent',
          borderRadius: 2,
          backgroundColor: c.crosshairTextBg,
        },
      },
      vertical: {
        show: true,
        line: {
          show: true,
          style: 'dashed',
          dashedValue: [2, 3],
          size: 1,
          color: c.crosshairLine,
        },
        text: {
          show: true,
          style: 'fill',
          color: c.crosshairTextFg,
          size: 10,
          family: MONO,
          weight: 'normal',
          paddingLeft: 4,
          paddingTop: 2,
          paddingRight: 4,
          paddingBottom: 2,
          borderStyle: 'solid',
          borderDashedValue: [2, 2],
          borderSize: 0,
          borderColor: 'transparent',
          borderRadius: 2,
          backgroundColor: c.crosshairTextBg,
        },
      },
    },
    indicator: {
      lines: [
        {
          style: 'solid',
          smooth: false,
          size: 1.4,
          dashedValue: [2, 2],
          color: EMA_FAST,
        },
        {
          style: 'solid',
          smooth: false,
          size: 1.6,
          dashedValue: [2, 2],
          color: EMA_SLOW,
        },
      ],
      lastValueMark: { show: false },
      tooltip: {
        showRule: 'follow_cross',
        showType: 'standard',
        title: {
          show: true,
          showName: true,
          showParams: true,
          size: 11,
          family: MONO,
          color: c.tooltipTitle,
          weight: 'normal',
        },
        legend: {
          size: 11,
          family: MONO,
          color: c.tooltipLegend,
          weight: 'normal',
        },
      },
    },
  }
}

function intervalToPeriod(interval: StockKLineInterval) {
  switch (interval) {
    case '5m': {
      return { span: 5, type: 'minute' as const }
    }
    case '15m': {
      return { span: 15, type: 'minute' as const }
    }
    case '1h': {
      return { span: 1, type: 'hour' as const }
    }
    case '1d': {
      return { span: 1, type: 'day' as const }
    }
  }
}

function intervalLabel(interval: StockKLineInterval): string {
  switch (interval) {
    case '5m': {
      return '5m candles'
    }
    case '15m': {
      return '15m candles'
    }
    case '1h': {
      return '1h candles'
    }
    case '1d': {
      return '1d candles'
    }
  }
}

function formatRange(from: string, to: string, locale: string): string {
  const start = new Date(from)
  const end = new Date(to)
  try {
    const fmt = new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    })
    const startLabel = fmt.format(start)
    const endLabel = fmt.format(end)
    if (startLabel === endLabel) return startLabel
    if (typeof fmt.formatRange === 'function') {
      return fmt.formatRange(start, end)
    }
    return `${startLabel} – ${endLabel}`
  } catch {
    const startLabel = start.toLocaleDateString()
    const endLabel = end.toLocaleDateString()
    return startLabel === endLabel ? startLabel : `${startLabel} – ${endLabel}`
  }
}

function FallbackChrome({
  symbol,
  rangeLabel,
  message,
  onRetry,
}: {
  symbol: string
  rangeLabel: string
  message: string
  onRetry?: () => void
}) {
  return (
    <PaperCardChrome>
      <div className="text-fg-muted mb-3 flex items-center justify-between text-[10px] tracking-[0.18em] uppercase">
        <span>{symbol}</span>
        <span className="text-[9px] tracking-[0.08em] opacity-70 normal-case">
          {rangeLabel}
        </span>
      </div>
      <div className="text-fg-muted flex h-[200px] w-full flex-col items-center justify-center gap-3 text-[12px] italic">
        <span>{message}</span>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="text-fg-muted hover:text-fg border-border hover:border-border-strong rounded-sm border px-2 py-1 text-[11px] not-italic transition-colors"
          >
            Retry
          </button>
        ) : null}
      </div>
    </PaperCardChrome>
  )
}

function KLineCard({
  meta,
  bars,
  interval,
  rangeLabel,
  emaPeriods,
  locale,
}: {
  meta: StockMeta
  bars: Bar[]
  interval: StockKLineInterval
  rangeLabel: string
  emaPeriods: [number, number] | false
  locale: string
}) {
  const { isDark } = useThemeMode()
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<Chart | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const [hoveredClose, setHoveredClose] = useState<number | null>(null)

  const styles = useMemo(
    () => buildStyles(isDark ? DARK_COLORS : LIGHT_COLORS),
    [isDark],
  )

  const numberFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [locale],
  )

  const formatNumber = (n: number | undefined): string => {
    if (n == null || !Number.isFinite(n)) return '—'
    return numberFormatter.format(n)
  }

  useEffect(() => {
    const el = containerRef.current
    if (!el || bars.length === 0) return

    let cancelled = false
    let disposed = false
    void (async () => {
      const { init, dispose } = await import('klinecharts')
      if (cancelled) return

      const chart = init(el, { styles })
      if (!chart) return
      chartRef.current = chart

      chart.setSymbol({ ticker: meta.symbol })
      chart.setPeriod(intervalToPeriod(interval))
      chart.setDataLoader({
        getBars: ({ callback }) => callback(bars),
      })

      if (emaPeriods) {
        chart.createIndicator({
          name: 'EMA',
          calcParams: [...emaPeriods],
          shortName: 'EMA',
          paneId: 'candle_pane',
        })
      }

      chart.setScrollEnabled(false)
      chart.setZoomEnabled(false)
      chart.setOffsetRightDistance(4)
      chart.setMaxOffsetRightDistance(4)

      const plotWidth = Math.max(0, el.clientWidth - 56)
      const desiredBarSpace = Math.max(
        6,
        Math.floor(plotWidth / Math.max(bars.length, 1)),
      )
      chart.setBarSpace(desiredBarSpace)

      // klinecharts v10 omits dataIndex from onCrosshairChange payload; derive
      // it from the pixel x via barSpace + visibleRange (spec §10.2 workaround).
      const crosshairHandler = (data?: unknown) => {
        const d = data as { x?: number; paneId?: string } | undefined
        if (typeof d?.x !== 'number') {
          setHoveredClose(null)
          return
        }
        const visibleRange = chart.getVisibleRange()
        const barSpace = chart.getBarSpace()
        if (!barSpace?.bar) {
          setHoveredClose(null)
          return
        }
        const k = Math.round((d.x - barSpace.halfBar) / barSpace.bar)
        const idx = visibleRange.realFrom + k
        const list = chart.getDataList()
        const bar = list[idx]
        setHoveredClose(typeof bar?.close === 'number' ? bar.close : null)
      }
      chart.subscribeAction('onCrosshairChange', crosshairHandler)

      const leaveHandler = () => setHoveredClose(null)
      el.addEventListener('mouseleave', leaveHandler)

      cleanupRef.current = () => {
        if (disposed) return
        disposed = true
        chart.unsubscribeAction('onCrosshairChange', crosshairHandler)
        el.removeEventListener('mouseleave', leaveHandler)
        dispose(el)
      }
    })()

    return () => {
      cancelled = true
      cleanupRef.current?.()
      cleanupRef.current = null
      chartRef.current = null
    }
  }, [bars, meta.symbol, interval, emaPeriods, styles])

  useEffect(() => {
    chartRef.current?.setStyles(styles)
  }, [styles])

  const last = bars.at(-1)
  const fallbackPrice = meta.regularMarketPrice ?? last?.close
  const displayedPrice = hoveredClose ?? fallbackPrice
  const previousClose = meta.chartPreviousClose ?? bars[0]?.open
  const delta =
    displayedPrice != null && previousClose != null
      ? displayedPrice - previousClose
      : 0
  const deltaPct =
    displayedPrice != null && previousClose ? (delta / previousClose) * 100 : 0
  const isUp = delta >= 0

  return (
    <PaperCardChrome>
      <StockHeader
        delta={formatNumber(delta)}
        deltaPct={formatNumber(deltaPct)}
        displayPrice={formatNumber(displayedPrice)}
        isUp={isUp}
        meta={meta}
      />

      <div className="h-[200px] w-full" ref={containerRef} />

      <StockFooter
        right={rangeLabel}
        left={
          <>
            {intervalLabel(interval)} · {bars.length}{' '}
            {bars.length === 1 ? 'bar' : 'bars'}
          </>
        }
      />
    </PaperCardChrome>
  )
}

export function StockKLineView({ symbol, range, ema }: Props) {
  const { locale } = useI18n()
  const rangeLabel = formatRange(range.from, range.to, locale)
  const { data, isLoading, isError, error, refetch } = useStockBars({
    symbol,
    from: range.from,
    to: range.to,
    interval: range.interval,
  })

  if (isLoading) {
    return (
      <FallbackChrome
        message="Loading bars…"
        rangeLabel={rangeLabel}
        symbol={symbol}
      />
    )
  }
  if (isError || !data) {
    const notFound = isStockNotFound(error)
    return (
      <FallbackChrome
        message={notFound ? 'Symbol not found' : 'Failed to load chart'}
        rangeLabel={rangeLabel}
        symbol={symbol}
        onRetry={notFound ? undefined : () => void refetch()}
      />
    )
  }

  return (
    <KLineCard
      bars={data.bars}
      emaPeriods={ema ?? [5, 20]}
      interval={range.interval}
      locale={locale}
      meta={data.meta}
      rangeLabel={rangeLabel}
    />
  )
}
