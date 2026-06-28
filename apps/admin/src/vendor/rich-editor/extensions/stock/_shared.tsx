import { AnimatePresence, m } from 'motion/react'
import type { CSSProperties, ReactNode } from 'react'

import { useThemeMode } from '~/theme'

import type { StockMeta } from './types'

export const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'
export const UP_STROKE = '#7AB892'
export const DOWN_FILL = '#C4715B'
export const EMA_FAST = '#7A95C4'
export const EMA_SLOW = '#8B7355'

const SERIF = '"Times New Roman", "Songti SC", serif'

export function SlotText({
  value,
  className,
  style,
}: {
  value: string
  className?: string
  style?: CSSProperties
}) {
  const chars = value.split('')
  return (
    <span
      className={`inline-flex items-baseline ${className ?? ''}`}
      style={style}
    >
      {chars.map((c, i) => {
        const isDigit = /\d/.test(c)
        if (!isDigit) {
          return (
            <span className="inline-block" key={`s-${i}`}>
              {c}
            </span>
          )
        }
        return (
          <span
            className="inline-flex items-end justify-center overflow-hidden"
            key={`d-${i}`}
            style={{
              height: '1.3em',
              minWidth: '0.6em',
              verticalAlign: 'baseline',
              lineHeight: 1,
            }}
          >
            <AnimatePresence initial={false} mode="popLayout">
              <m.span
                animate={{ y: 0, opacity: 1 }}
                className="block"
                exit={{ y: '-110%', opacity: 0 }}
                initial={{ y: '110%', opacity: 0 }}
                key={c}
                style={{ lineHeight: 1 }}
                transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
              >
                {c}
              </m.span>
            </AnimatePresence>
          </span>
        )
      })}
    </span>
  )
}

export function PaperCardChrome({
  children,
  className,
  style,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <div
      className={`bg-surface-card text-fg relative mx-auto w-full max-w-[520px] px-7 pt-6 pb-4 ${className ?? ''}`}
      style={{
        fontFeatureSettings: '"tnum", "ss01"',
        fontVariantNumeric: 'tabular-nums',
        ...style,
      }}
    >
      <div className="bg-border absolute inset-x-0 top-0 h-px opacity-70" />
      <div className="bg-border absolute inset-x-0 bottom-0 h-px opacity-70" />
      {children}
    </div>
  )
}

export function StockHeader({
  meta,
  displayPrice,
  delta,
  deltaPct,
  isUp,
  variantLabel,
  sourceNote,
  avatarUrl,
}: {
  meta: StockMeta
  displayPrice: string
  delta: string
  deltaPct: string
  isUp: boolean
  variantLabel?: string
  sourceNote?: string
  avatarUrl?: string
}) {
  const { isDark } = useThemeMode()
  const upText = isDark ? '#8FCFA5' : '#5A9C73'
  const downText = isDark ? '#D88673' : '#B85E45'

  const exch = meta.exchange?.split(/\s+|·/)[0]
  const tickerDisplay = exch ? `${exch} · ${meta.symbol}` : meta.symbol
  const displayName = meta.longName ?? meta.shortName ?? meta.symbol
  const sign = isUp ? '+' : ''

  return (
    <>
      {(variantLabel || sourceNote) && (
        <div
          className="text-fg-muted mb-3 flex items-center justify-between text-[10px] tracking-[0.18em] uppercase"
          style={{ fontFamily: MONO }}
        >
          <span>{variantLabel}</span>
          {sourceNote ? (
            <span className="text-[9px] tracking-[0.08em] opacity-70 normal-case">
              {sourceNote}
            </span>
          ) : null}
        </div>
      )}

      <header className="mb-5 flex items-end justify-between gap-4">
        <div className="flex items-end gap-3">
          {avatarUrl ? (
            <img
              alt=""
              className="bg-surface-inset mt-0.5 h-[26px] w-[26px] flex-shrink-0 rounded-[5px] object-contain p-[2px]"
              height={26}
              loading="lazy"
              src={avatarUrl}
              width={26}
            />
          ) : null}
          <div>
            <div
              className="text-fg-muted text-[11px] tracking-[0.1em] uppercase"
              style={{ fontFamily: MONO }}
            >
              {tickerDisplay}
            </div>
            <div
              className="text-fg mt-0.5 text-[15px] italic"
              style={{ fontFamily: SERIF }}
            >
              {displayName}
            </div>
          </div>
        </div>
        <div className="text-right">
          <SlotText
            className="text-fg text-[26px] leading-none tracking-[-0.015em]"
            style={{ fontWeight: 450 }}
            value={displayPrice}
          />
          <div
            className="mt-1 text-[12.5px]"
            style={{ color: isUp ? upText : downText, fontWeight: 500 }}
          >
            <SlotText value={`${sign}${delta} · ${sign}${deltaPct}%`} />
          </div>
        </div>
      </header>
    </>
  )
}

export function StockFooter({
  left,
  right,
}: {
  left: ReactNode
  right: ReactNode
}) {
  return (
    <footer className="text-fg-muted border-border mt-3 flex items-center justify-between border-t pt-3 text-[11px] tracking-[0.03em] opacity-90">
      <span>{left}</span>
      <span>{right}</span>
    </footer>
  )
}
