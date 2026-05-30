import { Select as BaseSelect } from '@base-ui/react/select'
import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'

import { PortalLayerScope, useFloatingZ } from '~/ui/feedback/portal-layer'
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
  const { z, depth } = useFloatingZ('popover')
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
          'outline-hidden shadow-xs flex h-9 w-full items-center justify-between gap-2 rounded-sm border border-border bg-surface-card px-3 text-left text-sm text-fg transition-colors hover:bg-surface-inset data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60 data-[focus-visible]:outline-hidden data-[focus-visible]:ring-[3px] data-[focus-visible]:ring-accent/15',
          props.triggerClassName,
          props.className,
        )}
      >
        <BaseSelect.Value />
        <ChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 text-fg-subtle"
        />
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner style={{ zIndex: z }}>
          <PortalLayerScope depth={depth}>
            <BaseSelect.Popup
              className={cn(
                'outline-hidden shadow-md w-[var(--anchor-width)] rounded-lg bg-surface-overlay text-sm',
                props.popupClassName,
              )}
            >
              <Scroll
                className="max-h-72"
                innerClassName="p-1"
                viewportClassName="max-h-72"
              >
                {props.options.map((option) => (
                  <BaseSelect.Item
                    className="outline-hidden cursor-pointer rounded-sm px-2 py-1.5 text-fg data-[highlighted]:bg-surface-inset data-[selected]:bg-accent-soft data-[selected]:text-fg"
                    key={String(option.value)}
                    value={option.value}
                  >
                    {option.label}
                  </BaseSelect.Item>
                ))}
              </Scroll>
            </BaseSelect.Popup>
          </PortalLayerScope>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  )
}
