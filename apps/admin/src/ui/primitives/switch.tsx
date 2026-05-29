import { Switch as BaseSwitch } from '@base-ui/react/switch'
import type { ReactNode } from 'react'

import { cn } from '~/utils/cn'

const TOGGLE_ROOT_CLASS =
  'outline-hidden relative inline-flex h-5 min-w-9 items-center rounded-full bg-neutral-200 px-0.5 transition-colors data-[disabled]:cursor-not-allowed data-[checked]:bg-neutral-950 data-[disabled]:opacity-50 data-[focus-visible]:ring-2 data-[focus-visible]:ring-[var(--color-primary-shallow)] dark:bg-neutral-800 dark:data-[checked]:bg-neutral-50'

const TOGGLE_THUMB_CLASS =
  'shadow-xs block size-4 translate-x-0 rounded-full bg-white transition-transform data-[checked]:translate-x-4 dark:data-[checked]:bg-neutral-950'

export function Toggle(props: {
  'aria-label'?: string
  checked: boolean
  className?: string
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <BaseSwitch.Root
      aria-label={props['aria-label']}
      checked={props.checked}
      className={cn(TOGGLE_ROOT_CLASS, props.className)}
      disabled={props.disabled}
      onCheckedChange={props.onCheckedChange}
    >
      <BaseSwitch.Thumb className={TOGGLE_THUMB_CLASS} />
    </BaseSwitch.Root>
  )
}

interface SwitchProps {
  bordered?: boolean
  checked: boolean
  className?: string
  description?: ReactNode
  disabled?: boolean
  label: ReactNode
  onCheckedChange: (checked: boolean) => void
}

export function Switch(props: SwitchProps) {
  return (
    <label
      className={cn(
        'flex items-center justify-between gap-4 text-sm',
        props.bordered
          ? 'rounded border border-neutral-200 px-3 py-2 dark:border-neutral-800'
          : null,
        props.className,
        props.disabled && 'opacity-60',
      )}
    >
      <span className="min-w-0">
        <span className="block text-neutral-800 dark:text-neutral-200">
          {props.label}
        </span>
        {props.description ? (
          <span className="mt-0.5 block text-xs text-neutral-500 dark:text-neutral-400">
            {props.description}
          </span>
        ) : null}
      </span>
      <BaseSwitch.Root
        checked={props.checked}
        className={TOGGLE_ROOT_CLASS}
        disabled={props.disabled}
        onCheckedChange={props.onCheckedChange}
      >
        <BaseSwitch.Thumb className={TOGGLE_THUMB_CLASS} />
      </BaseSwitch.Root>
    </label>
  )
}
