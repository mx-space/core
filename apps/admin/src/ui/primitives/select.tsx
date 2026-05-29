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
          'outline-hidden flex h-9 w-full items-center justify-between gap-2 rounded border border-neutral-200 bg-white px-3 text-left text-sm text-neutral-900 transition-colors hover:bg-neutral-50 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60 data-[focus-visible]:ring-2 data-[focus-visible]:ring-[var(--color-primary-shallow)] dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-900',
          props.triggerClassName,
          props.className,
        )}
      >
        <BaseSelect.Value />
        <ChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 text-neutral-400"
        />
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner style={{ zIndex: z }}>
          <PortalLayerScope depth={depth}>
            <BaseSelect.Popup
              className={cn(
                'outline-hidden w-[var(--anchor-width)] rounded border border-neutral-200 bg-white text-sm shadow-lg dark:border-neutral-800 dark:bg-neutral-950',
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
                    className="outline-hidden cursor-pointer rounded px-2 py-1.5 text-neutral-700 data-[highlighted]:bg-neutral-100 data-[selected]:text-[var(--color-primary)] dark:text-neutral-200 dark:data-[highlighted]:bg-neutral-800"
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
