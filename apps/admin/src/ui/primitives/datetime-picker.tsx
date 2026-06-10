import { Field } from '@base-ui/react/field'
import { Popover } from '@base-ui/react/popover'
import { useDatePicker } from '@rehookify/datepicker'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { useCallback, useMemo, useState } from 'react'

import { useI18n } from '~/i18n'
import { PortalLayerScope, useFloatingZ } from '~/ui/feedback/portal-layer'
import { cn } from '~/utils/cn'

interface DateTimePickerProps {
  className?: string
  controlClassName?: string
  disabled?: boolean
  id?: string
  label?: ReactNode
  labelClassName?: string
  max?: string
  min?: string
  name?: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  style?: CSSProperties
  /** datetime-local 字符串："YYYY-MM-DDTHH:mm" */
  value: string
}

type View = 'day' | 'month' | 'year'

const DISPLAY_FORMAT = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function parseDatetimeLocal(value: string | undefined | null): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function toDatetimeLocal(date: Date): string {
  const offset = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return offset.toISOString().slice(0, 16)
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function DateTimePicker(props: DateTimePickerProps) {
  const { value, onChange, min, max, disabled, required } = props
  const { t } = useI18n()
  const { z, depth } = useFloatingZ('popover')
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>('day')

  const current = useMemo(() => parseDatetimeLocal(value), [value])
  const minDate = useMemo(() => parseDatetimeLocal(min) ?? undefined, [min])
  const maxDate = useMemo(() => parseDatetimeLocal(max) ?? undefined, [max])

  const [offsetDate, setOffsetDate] = useState<Date>(
    () => parseDatetimeLocal(value) ?? new Date(),
  )

  const selectedDates = useMemo(() => (current ? [current] : []), [current])

  const handleDatesChange = useCallback(
    (dates: Date[]) => {
      const next = dates[0]
      if (!next) {
        onChange('')
        return
      }

      let merged = next
      if (current) {
        if (!isSameDay(next, current)) {
          merged = new Date(next)
          merged.setHours(current.getHours())
          merged.setMinutes(current.getMinutes())
          merged.setSeconds(0, 0)
        }
      } else {
        const now = new Date()
        merged = new Date(next)
        if (isSameDay(merged, now)) {
          merged.setHours(now.getHours())
          merged.setMinutes(now.getMinutes())
        } else {
          merged.setHours(9)
          merged.setMinutes(0)
        }
        merged.setSeconds(0, 0)
      }

      onChange(toDatetimeLocal(merged))
    },
    [current, onChange],
  )

  const {
    data: { calendars, weekDays, time, months, years },
    propGetters: {
      dayButton,
      timeButton,
      monthButton,
      yearButton,
      addOffset,
      subtractOffset,
      nextYearsButton,
      previousYearsButton,
    },
  } = useDatePicker({
    selectedDates,
    onDatesChange: handleDatesChange,
    offsetDate,
    onOffsetChange: setOffsetDate,
    dates: { mode: 'single', minDate, maxDate, toggle: false },
    time: { interval: 30 },
    years: { mode: 'decade', numberOfYears: 12, step: 10 },
    locale: { locale: 'zh-CN' },
  })

  const { year, month, days } = calendars[0]
  const yearNumber = offsetDate.getFullYear()
  const displayValue = current ? DISPLAY_FORMAT.format(current) : ''

  const decadeLabel = useMemo(() => {
    if (years.length === 0) return ''
    return `${years[0].year} - ${years.at(-1)?.year ?? years[0].year}`
  }, [years])

  const navButtonClass =
    'flex size-7 items-center justify-center rounded-sm text-fg-muted hover:bg-surface-inset'
  const headerTextButtonClass =
    'rounded-sm px-1.5 py-0.5 text-sm font-medium text-fg transition-colors hover:bg-surface-inset'

  const dayView = (
    <>
      <div className="mb-2 flex items-center justify-between">
        <button
          {...subtractOffset({ months: 1 })}
          className={navButtonClass}
          type="button"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
        </button>
        <div className="flex items-center gap-1">
          <button
            className={headerTextButtonClass}
            onClick={() => setView('year')}
            type="button"
          >
            {year}
          </button>
          <button
            className={headerTextButtonClass}
            onClick={() => setView('month')}
            type="button"
          >
            {month}
          </button>
        </div>
        <button
          {...addOffset({ months: 1 })}
          className={navButtonClass}
          type="button"
        >
          <ChevronRight aria-hidden="true" className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-xs text-fg-subtle">
        {weekDays.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-0.5">
        {days.map((day) => (
          <button
            {...dayButton(day)}
            className={cn(
              'flex h-8 items-center justify-center rounded-sm text-xs transition-colors',
              day.inCurrentMonth ? 'text-fg' : 'text-fg-subtle/60',
              day.selected && 'bg-accent text-white hover:bg-accent',
              !day.selected && 'hover:bg-surface-inset',
              day.now && !day.selected && 'ring-1 ring-accent',
              day.disabled &&
                'cursor-not-allowed opacity-40 hover:bg-transparent',
            )}
            key={day.$date.toISOString()}
            type="button"
          >
            {day.$date.getDate()}
          </button>
        ))}
      </div>
    </>
  )

  const monthView = (
    <>
      <div className="mb-3 flex items-center justify-between">
        <button
          {...subtractOffset({ years: 1 })}
          className={navButtonClass}
          type="button"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
        </button>
        <button
          className={headerTextButtonClass}
          onClick={() => setView('year')}
          type="button"
        >
          {yearNumber}
        </button>
        <button
          {...addOffset({ years: 1 })}
          className={navButtonClass}
          type="button"
        >
          <ChevronRight aria-hidden="true" className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {months.map((m) => (
          <button
            {...monthButton(m, { onClick: () => setView('day') })}
            className={cn(
              'flex h-10 items-center justify-center rounded-sm text-xs transition-colors',
              m.active
                ? 'bg-accent text-white'
                : 'text-fg hover:bg-surface-inset',
              m.now && !m.active && 'ring-1 ring-accent',
              m.disabled && 'cursor-not-allowed opacity-40',
            )}
            key={m.$date.toISOString()}
            type="button"
          >
            {m.month}
          </button>
        ))}
      </div>
    </>
  )

  const yearView = (
    <>
      <div className="mb-3 flex items-center justify-between">
        <button
          {...previousYearsButton()}
          className={navButtonClass}
          type="button"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
        </button>
        <span className="text-sm font-medium text-fg">{decadeLabel}</span>
        <button {...nextYearsButton()} className={navButtonClass} type="button">
          <ChevronRight aria-hidden="true" className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {years.map((y) => (
          <button
            {...yearButton(y, { onClick: () => setView('month') })}
            className={cn(
              'flex h-10 items-center justify-center rounded-sm text-xs transition-colors',
              y.active
                ? 'bg-accent text-white'
                : 'text-fg hover:bg-surface-inset',
              y.now && !y.active && 'ring-1 ring-accent',
              y.disabled && 'cursor-not-allowed opacity-40',
            )}
            key={y.year}
            type="button"
          >
            {y.year}
          </button>
        ))}
      </div>
    </>
  )

  const calendarPane =
    view === 'day' ? dayView : view === 'month' ? monthView : yearView

  const control = (
    <Popover.Root
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setView('day')
      }}
      open={open}
    >
      <Popover.Trigger
        className={cn(
          'outline-hidden shadow-xs flex h-8 w-full items-center justify-between rounded-sm border border-border bg-surface-card px-3 text-sm transition-colors focus:border-accent focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-60',
          displayValue ? 'text-fg' : 'text-fg-subtle',
          props.controlClassName,
        )}
        disabled={disabled}
        id={props.id}
        name={props.name}
        style={props.style}
        type="button"
      >
        <span className="truncate">
          {displayValue ||
            props.placeholder ||
            t('ui.datetimePicker.placeholder')}
        </span>
        <CalendarIcon
          aria-hidden="true"
          className="ml-2 size-4 shrink-0 text-fg-subtle"
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          align="start"
          side="bottom"
          sideOffset={4}
          style={{ zIndex: z }}
        >
          <PortalLayerScope depth={depth}>
            <Popover.Popup className="outline-hidden shadow-md overflow-hidden rounded-lg bg-surface-overlay text-sm">
              <div className="flex">
                <div className="w-64 p-3">{calendarPane}</div>
                <div className="flex w-28 flex-col border-l border-border">
                  <div className="px-3 pb-1 pt-3 text-xs text-fg-subtle">
                    {t('ui.datetimePicker.time')}
                  </div>
                  <div className="grid max-h-56 grid-cols-1 gap-0.5 overflow-y-auto px-2 pb-2">
                    {time.map((t) => (
                      <button
                        {...timeButton(t)}
                        className={cn(
                          'rounded-sm px-2 py-1 text-xs transition-colors',
                          t.selected
                            ? 'bg-accent text-white'
                            : 'text-fg-muted hover:bg-surface-inset',
                          t.disabled && 'cursor-not-allowed opacity-40',
                        )}
                        key={t.time}
                        type="button"
                      >
                        {t.time}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-border px-3 py-2">
                <button
                  className="text-xs text-fg-muted hover:text-fg disabled:opacity-40"
                  disabled={!current}
                  onClick={() => {
                    onChange('')
                    setOpen(false)
                  }}
                  type="button"
                >
                  {t('ui.datetimePicker.clear')}
                </button>
                <button
                  className="text-xs text-accent hover:underline"
                  onClick={() => setOpen(false)}
                  type="button"
                >
                  {t('ui.datetimePicker.done')}
                </button>
              </div>
            </Popover.Popup>
          </PortalLayerScope>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )

  if (!props.label) {
    return (
      <Field.Root className={cn('contents', props.className)}>
        {control}
      </Field.Root>
    )
  }

  return (
    <Field.Root className={cn('grid gap-1.5 text-sm', props.className)}>
      <Field.Label className={cn('font-medium text-fg', props.labelClassName)}>
        {props.label}
        {required ? <span className="text-red-500"> *</span> : null}
      </Field.Label>
      {control}
    </Field.Root>
  )
}
