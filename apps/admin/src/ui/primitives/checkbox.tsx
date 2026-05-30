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
        'outline-hidden inline-flex size-4 items-center justify-center rounded-xs border border-border-strong bg-surface-card text-white transition-colors data-[disabled]:cursor-not-allowed data-[checked]:border-accent data-[indeterminate]:border-accent data-[checked]:bg-accent data-[indeterminate]:bg-accent data-[disabled]:opacity-50 data-[focus-visible]:outline-hidden data-[focus-visible]:ring-[3px] data-[focus-visible]:ring-accent/15',
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
    <label className="inline-flex items-center gap-2 text-sm text-fg">
      {control}
      <span>{props.label}</span>
    </label>
  )
}
