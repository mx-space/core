import { Select as BaseSelect } from '@base-ui/react/select'
import { Check, ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'

import {
  useFloatLayerContainer,
  useLayerZIndex,
} from '~/ui/overlay/floating-layer'
import { menuStyles } from '~/ui/overlay/menu-styles'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

type SelectValue = number | string

export interface SelectOption<TValue extends SelectValue = string> {
  label: ReactNode
  value: TValue
}

interface SelectFieldProps<TValue extends SelectValue = string> {
  'aria-label'?: string
  className?: string
  disabled?: boolean
  id?: string
  onValueChange: (value: TValue) => void
  options: SelectOption<TValue>[]
  popupClassName?: string
  triggerClassName?: string
  value: TValue
}

export function SelectField<TValue extends SelectValue = string>(
  props: SelectFieldProps<TValue>,
) {
  const { ref: zRef, zIndex } = useLayerZIndex<HTMLDivElement>('floating')
  const container = useFloatLayerContainer()
  return (
    <BaseSelect.Root<TValue>
      disabled={props.disabled}
      id={props.id}
      items={props.options}
      onValueChange={(value) => {
        if (value !== null) props.onValueChange(value)
      }}
      value={props.value}
    >
      <BaseSelect.Trigger
        aria-label={props['aria-label']}
        className={cn(
          'outline-hidden shadow-xs flex h-8 w-full items-center justify-between gap-2 rounded-sm border border-border bg-surface-card pl-3 pr-2 text-left text-sm text-fg transition-colors hover:bg-surface-inset data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60 data-[focus-visible]:outline-hidden data-[focus-visible]:ring-[3px] data-[focus-visible]:ring-accent/15',
          props.triggerClassName,
          props.className,
        )}
      >
        <BaseSelect.Value className="truncate whitespace-nowrap" />
        <ChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 text-fg-subtle"
        />
      </BaseSelect.Trigger>
      <BaseSelect.Portal container={container ?? undefined}>
        <BaseSelect.Positioner ref={zRef} style={{ zIndex }}>
          <BaseSelect.Popup
            className={cn(
              'outline-hidden shadow-lg w-[var(--anchor-width)] rounded-lg border border-border bg-surface-overlay p-1 text-sm text-fg',
              props.popupClassName,
            )}
          >
            <Scroll
              className="max-h-72"
              innerClassName="flex flex-col"
              viewportClassName="max-h-72"
            >
              {props.options.map((option) => (
                <BaseSelect.Item
                  className={cn(
                    menuStyles.item,
                    'data-[selected]:bg-accent-soft data-[selected]:text-fg',
                  )}
                  key={String(option.value)}
                  value={option.value}
                >
                  <span className={menuStyles.label}>{option.label}</span>
                  <BaseSelect.ItemIndicator
                    className={menuStyles.indicatorRight}
                  >
                    <Check aria-hidden="true" className="size-3.5" />
                  </BaseSelect.ItemIndicator>
                </BaseSelect.Item>
              ))}
            </Scroll>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  )
}
