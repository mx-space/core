import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox'
import { Check, Minus } from 'lucide-react'
import type { MouseEventHandler, ReactNode } from 'react'

import { cn } from '~/utils/cn'

interface CheckboxProps {
  'aria-label'?: string
  checked: boolean
  className?: string
  disabled?: boolean
  indeterminate?: boolean
  label?: ReactNode
  onCheckedChange: (checked: boolean) => void
  onClick?: MouseEventHandler<HTMLElement>
}

export function Checkbox(props: CheckboxProps) {
  const control = (
    <BaseCheckbox.Root
      aria-label={props['aria-label']}
      checked={props.checked}
      className={cn(
        'outline-hidden inline-flex size-4 items-center justify-center rounded border border-neutral-300 bg-white text-white transition-colors data-[disabled]:cursor-not-allowed data-[checked]:border-neutral-950 data-[indeterminate]:border-neutral-950 data-[checked]:bg-neutral-950 data-[indeterminate]:bg-neutral-950 data-[disabled]:opacity-50 data-[focus-visible]:ring-2 data-[focus-visible]:ring-[var(--color-primary-shallow)] dark:border-neutral-700 dark:bg-neutral-950 dark:data-[checked]:border-neutral-50 dark:data-[indeterminate]:border-neutral-50 dark:data-[checked]:bg-neutral-50 dark:data-[indeterminate]:bg-neutral-50 dark:data-[checked]:text-neutral-950 dark:data-[indeterminate]:text-neutral-950',
        props.className,
      )}
      disabled={props.disabled}
      indeterminate={props.indeterminate}
      onCheckedChange={props.onCheckedChange}
      onClick={props.onClick}
    >
      <BaseCheckbox.Indicator>
        {props.indeterminate ? (
          <Minus aria-hidden="true" className="size-3" />
        ) : (
          <Check aria-hidden="true" className="size-3" />
        )}
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  )

  if (!props.label) return control

  return (
    <label className="inline-flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
      {control}
      <span>{props.label}</span>
    </label>
  )
}
