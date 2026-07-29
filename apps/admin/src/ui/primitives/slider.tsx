import { Slider as BaseSlider } from '@base-ui/react/slider'
import type { ReactNode } from 'react'

import { cn } from '~/utils/cn'

interface SliderProps {
  'aria-label'?: string
  className?: string
  disabled?: boolean
  label?: ReactNode
  max: number
  min?: number
  onValueChange: (value: number) => void
  step?: number
  value: number
  valueLabel?: ReactNode
}

export function Slider(props: SliderProps) {
  return (
    <div
      className={cn(
        'grid gap-1.5 text-sm',
        props.disabled && 'opacity-60',
        props.className,
      )}
    >
      {props.label || props.valueLabel ? (
        <div className="flex items-baseline justify-between gap-4">
          {props.label ? (
            <span className="font-medium text-fg">{props.label}</span>
          ) : null}
          {props.valueLabel ? (
            <span className="text-xs tabular-nums text-fg-muted">
              {props.valueLabel}
            </span>
          ) : null}
        </div>
      ) : null}
      <BaseSlider.Root
        disabled={props.disabled}
        max={props.max}
        min={props.min ?? 0}
        onValueChange={(value) => props.onValueChange(value)}
        step={props.step ?? 1}
        value={props.value}
      >
        <BaseSlider.Control className="flex w-full touch-none select-none items-center py-2 data-[disabled]:cursor-not-allowed">
          <BaseSlider.Track className="relative h-1 w-full rounded-full bg-surface-inset">
            <BaseSlider.Indicator className="rounded-full bg-accent" />
            <BaseSlider.Thumb
              aria-label={props['aria-label']}
              className="shadow-xs size-4 rounded-full border border-border bg-white outline-hidden transition-shadow data-[dragging]:border-border-strong has-[input:focus-visible]:ring-[3px] has-[input:focus-visible]:ring-accent/15"
            />
          </BaseSlider.Track>
        </BaseSlider.Control>
      </BaseSlider.Root>
    </div>
  )
}
