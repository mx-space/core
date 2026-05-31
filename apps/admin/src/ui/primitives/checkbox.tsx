import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox'
import { Check, Minus } from 'lucide-react'
import type { MouseEventHandler, ReactNode } from 'react'

import { cn } from '~/utils/cn'

interface CheckboxProps {
  'aria-label'?: string
  checked: boolean
  className?: string
  /**
   * Implicit cursor mark — true when the row is the keyboard cursor target
   * but is NOT in the explicit checked set. Renders a soft accent dot inside
   * the empty box as a "would be checked if Space is pressed" hint. When
   * combined with `checked`, adds a faint outer ring instead.
   */
  cursor?: boolean
  disabled?: boolean
  indeterminate?: boolean
  label?: ReactNode
  onCheckedChange: (checked: boolean) => void
  onClick?: MouseEventHandler<HTMLElement>
}

export function Checkbox(props: CheckboxProps) {
  const showCursorDot = props.cursor && !props.checked && !props.indeterminate
  const control = (
    <BaseCheckbox.Root
      aria-label={props['aria-label']}
      checked={props.checked}
      className={cn(
        'outline-hidden relative inline-flex size-4 items-center justify-center rounded-xs border border-border-strong bg-surface-card text-white transition-colors data-[disabled]:cursor-not-allowed data-[checked]:border-accent data-[indeterminate]:border-accent data-[checked]:bg-accent data-[indeterminate]:bg-accent data-[disabled]:opacity-50 data-[focus-visible]:outline-hidden data-[focus-visible]:ring-[3px] data-[focus-visible]:ring-accent/15',
        // Cursor + checked: faint accent outline ring so the row stands
        // out as "the active checked one" among multi-selected rows.
        props.cursor &&
          (props.checked || props.indeterminate) &&
          'ring-[2px] ring-accent/35',
        // Cursor only (unchecked): accent border tint to hint "Space promotes
        // me." Center dot rendered inside the indicator slot.
        showCursorDot && 'border-accent',
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
      {showCursorDot ? (
        <span
          aria-hidden="true"
          className="absolute size-1.5 rounded-full bg-accent"
        />
      ) : null}
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
