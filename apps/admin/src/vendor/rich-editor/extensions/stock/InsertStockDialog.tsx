import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { ModalHeader } from '~/ui/feedback/modal'
import { present, useModal } from '~/ui/feedback/modal-imperative'
import { Button } from '~/ui/primitives/button'
import {
  SegmentedControl,
  type SegmentedControlOption,
} from '~/ui/primitives/segmented-control'
import { TextInput } from '~/ui/primitives/text-field'

import type { StockKLineRange, StockVariant } from './stock-augment'
import { StockBlock } from './StockBlock'
import type { StockNodePayload } from './StockNode'
import type { StockKLineInterval } from './types'

type EmaPreset = 'off' | '5,10' | '5,20' | '12,26' | 'custom'

interface InsertStockDialogProps {
  initial?: StockNodePayload
  onSubmit: (payload: StockNodePayload) => void
  variant?: StockVariant
}

interface PreviewState {
  ema: [number, number] | false
  from: string
  interval: StockKLineInterval
  symbol: string
  to: string
  variant: StockVariant
}

const DEFAULT_EMA: [number, number] = [5, 20]
const PREVIEW_DEBOUNCE_MS = 400
const EMA_MIN = 2
const EMA_MAX = 200

const VARIANT_OPTIONS: SegmentedControlOption<StockVariant>[] = [
  { label: 'Snapshot', value: 'snapshot' },
  { label: 'K-line', value: 'kline' },
]

const INTERVAL_OPTIONS: SegmentedControlOption<StockKLineInterval>[] = [
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '1h', value: '1h' },
  { label: '1d', value: '1d' },
]

const EMA_OPTIONS: SegmentedControlOption<EmaPreset>[] = [
  { label: 'Off', value: 'off' },
  { label: '5,10', value: '5,10' },
  { label: '5,20', value: '5,20' },
  { label: '12,26', value: '12,26' },
  { label: 'Custom', value: 'custom' },
]

function detectEmaPreset(ema: [number, number] | false | undefined): EmaPreset {
  if (ema === false) return 'off'
  if (!ema) return '5,20'
  const [a, b] = ema
  if (a === 5 && b === 10) return '5,10'
  if (a === 5 && b === 20) return '5,20'
  if (a === 12 && b === 26) return '12,26'
  return 'custom'
}

function emaFromPreset(
  preset: EmaPreset,
  custom: [number, number],
): [number, number] | false {
  switch (preset) {
    case 'off': {
      return false
    }
    case '5,10': {
      return [5, 10]
    }
    case '5,20': {
      return [5, 20]
    }
    case '12,26': {
      return [12, 26]
    }
    case 'custom': {
      return custom
    }
  }
}

function toDatetimeLocal(value: string): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.valueOf())) return ''
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDatetimeLocal(value: string): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.valueOf())) return value
  return d.toISOString()
}

function InsertStockDialog(props: InsertStockDialogProps) {
  const modal = useModal<void>()
  const { initial } = props

  const startingVariant: StockVariant =
    initial?.variant ?? props.variant ?? 'snapshot'
  const initialKlineRange =
    initial?.variant === 'kline' ? initial.range : undefined
  const initialEma = initial?.variant === 'kline' ? initial.ema : undefined
  const initialEmaPreset = detectEmaPreset(initialEma)
  const initialCustomEma: [number, number] =
    initialEma && initialEmaPreset === 'custom' ? initialEma : DEFAULT_EMA

  const [variant, setVariant] = useState<StockVariant>(startingVariant)
  const [symbol, setSymbol] = useState(initial?.symbol ?? '')
  const [intervalValue, setIntervalValue] = useState<StockKLineInterval>(
    initialKlineRange?.interval ?? '1d',
  )
  const [fromValue, setFromValue] = useState(
    toDatetimeLocal(initialKlineRange?.from ?? ''),
  )
  const [toValue, setToValue] = useState(
    toDatetimeLocal(initialKlineRange?.to ?? ''),
  )
  const [emaPreset, setEmaPreset] = useState<EmaPreset>(initialEmaPreset)
  const [customEma, setCustomEma] = useState<[number, number]>(initialCustomEma)

  const trimmedSymbol = symbol.trim()
  const hasSymbol = trimmedSymbol.length > 0
  const hasRange = fromValue.length > 0 && toValue.length > 0

  const initialPreview: PreviewState = {
    variant: startingVariant,
    symbol: initial?.symbol?.trim() ?? '',
    interval: initialKlineRange?.interval ?? '1d',
    from: initialKlineRange?.from ?? '',
    to: initialKlineRange?.to ?? '',
    ema: initialEma ?? DEFAULT_EMA,
  }
  const [debouncedPreview, setDebouncedPreview] =
    useState<PreviewState>(initialPreview)

  useEffect(() => {
    const next: PreviewState = {
      variant,
      symbol: trimmedSymbol,
      interval: intervalValue,
      from: fromValue ? fromDatetimeLocal(fromValue) : '',
      to: toValue ? fromDatetimeLocal(toValue) : '',
      ema: emaFromPreset(emaPreset, customEma),
    }
    const t = window.setTimeout(
      () => setDebouncedPreview(next),
      PREVIEW_DEBOUNCE_MS,
    )
    return () => window.clearTimeout(t)
  }, [
    variant,
    trimmedSymbol,
    intervalValue,
    fromValue,
    toValue,
    emaPreset,
    customEma,
  ])

  const canInsert = variant === 'snapshot' ? hasSymbol : hasSymbol && hasRange

  const onInsert = () => {
    if (!hasSymbol) {
      toast.error('Symbol is required')
      return
    }
    if (variant === 'snapshot') {
      props.onSubmit({ variant: 'snapshot', symbol: trimmedSymbol })
      modal.close()
      return
    }
    if (!hasRange) {
      toast.error('Range is required for K-line')
      return
    }
    const range: StockKLineRange = {
      from: fromDatetimeLocal(fromValue),
      to: fromDatetimeLocal(toValue),
      interval: intervalValue,
    }
    const ema = emaFromPreset(emaPreset, customEma)
    props.onSubmit({
      variant: 'kline',
      symbol: trimmedSymbol,
      range,
      ema,
    })
    modal.close()
  }

  return (
    <div className="flex w-full flex-col">
      <ModalHeader title="Insert stock" />
      <div className="grid w-full grid-cols-1 gap-5 px-5 py-5 md:h-[520px] md:grid-cols-[20rem_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4 md:min-h-0 md:overflow-y-auto md:pr-1">
          <SegmentedControl
            aria-label="Variant"
            fill
            onValueChange={(next) => setVariant(next)}
            options={VARIANT_OPTIONS}
            value={variant}
          />
          <TextInput
            autoFocus
            label="Symbol"
            onChange={setSymbol}
            placeholder="e.g. AAPL · NASDAQ:AAPL · 9988.HK"
            required
            value={symbol}
          />
          {variant === 'kline' ? (
            <KLineFields
              customEma={customEma}
              emaPreset={emaPreset}
              fromValue={fromValue}
              intervalValue={intervalValue}
              onCustomEmaChange={setCustomEma}
              onEmaPresetChange={setEmaPreset}
              onFromChange={setFromValue}
              onIntervalChange={setIntervalValue}
              onToChange={setToValue}
              toValue={toValue}
            />
          ) : null}
        </div>
        <div className="min-w-0 overflow-hidden rounded-md border border-border bg-surface-inset">
          <PreviewPane preview={debouncedPreview} />
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
        <Button onClick={() => modal.dismiss()} type="button" variant="subtle">
          Cancel
        </Button>
        <Button disabled={!canInsert} onClick={onInsert} type="button">
          Insert
        </Button>
      </div>
    </div>
  )
}

function KLineFields({
  customEma,
  emaPreset,
  fromValue,
  intervalValue,
  onCustomEmaChange,
  onEmaPresetChange,
  onFromChange,
  onIntervalChange,
  onToChange,
  toValue,
}: {
  customEma: [number, number]
  emaPreset: EmaPreset
  fromValue: string
  intervalValue: StockKLineInterval
  onCustomEmaChange: (next: [number, number]) => void
  onEmaPresetChange: (next: EmaPreset) => void
  onFromChange: (next: string) => void
  onIntervalChange: (next: StockKLineInterval) => void
  onToChange: (next: string) => void
  toValue: string
}) {
  const dateInputClass =
    'w-full min-w-0 rounded-sm border border-border bg-surface-card px-2.5 py-1.5 text-sm text-fg focus:outline-hidden focus:ring-[3px] focus:ring-accent/15'

  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <label className="text-xs font-medium text-fg">Interval</label>
        <SegmentedControl
          aria-label="Interval"
          fill
          onValueChange={(next) => onIntervalChange(next)}
          options={INTERVAL_OPTIONS}
          value={intervalValue}
        />
      </div>
      <div className="grid gap-2">
        <div className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-2">
          <label className="text-xs font-medium text-fg" htmlFor="stock-from">
            From
          </label>
          <input
            className={dateInputClass}
            id="stock-from"
            onChange={(event) => onFromChange(event.target.value)}
            type={intervalValue === '1d' ? 'date' : 'datetime-local'}
            value={fromValue}
          />
        </div>
        <div className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-2">
          <label className="text-xs font-medium text-fg" htmlFor="stock-to">
            To
          </label>
          <input
            className={dateInputClass}
            id="stock-to"
            onChange={(event) => onToChange(event.target.value)}
            type={intervalValue === '1d' ? 'date' : 'datetime-local'}
            value={toValue}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <label className="text-xs font-medium text-fg">EMA</label>
        <SegmentedControl
          aria-label="EMA preset"
          fill
          onValueChange={(next) => onEmaPresetChange(next)}
          options={EMA_OPTIONS}
          value={emaPreset}
        />
        {emaPreset === 'custom' ? (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <TextInput
              inputMode="numeric"
              label="Fast"
              min={EMA_MIN}
              onChange={(value) => {
                const next = Number.parseInt(value, 10)
                if (Number.isFinite(next) && next >= EMA_MIN && next <= EMA_MAX)
                  onCustomEmaChange([next, customEma[1]])
              }}
              type="number"
              value={String(customEma[0])}
            />
            <TextInput
              inputMode="numeric"
              label="Slow"
              min={EMA_MIN}
              onChange={(value) => {
                const next = Number.parseInt(value, 10)
                if (Number.isFinite(next) && next >= EMA_MIN && next <= EMA_MAX)
                  onCustomEmaChange([customEma[0], next])
              }}
              type="number"
              value={String(customEma[1])}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}

function PreviewPane({ preview }: { preview: PreviewState }) {
  const placeholder = useMemo(() => {
    if (!preview.symbol) return 'Enter a symbol to preview.'
    if (preview.variant === 'kline' && (!preview.from || !preview.to))
      return 'Choose a date range to preview.'
    return null
  }, [preview])

  if (placeholder) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-center text-xs text-fg-muted">
        {placeholder}
      </div>
    )
  }

  if (preview.variant === 'kline') {
    return (
      <div className="p-3">
        <StockBlock
          ema={preview.ema}
          range={{
            from: preview.from,
            to: preview.to,
            interval: preview.interval,
          }}
          symbol={preview.symbol}
          variant="kline"
        />
      </div>
    )
  }
  return (
    <div className="p-3">
      <StockBlock symbol={preview.symbol} variant="snapshot" />
    </div>
  )
}

export function presentInsertStockDialog(props: InsertStockDialogProps) {
  return present<InsertStockDialogProps, void>(InsertStockDialog, props, {
    modalProps: { popupStyle: { width: 'min(94vw, 52rem)' } },
  })
}
