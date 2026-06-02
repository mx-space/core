import { Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { cn } from '~/utils/cn'

export interface ExpandableSearchProps {
  /** Controlled open state. The host typically uses this to fade siblings. */
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Initial input value when first mounted. */
  initialValue?: string
  /** Debounced callback when the value changes. */
  onSearch: (value: string) => void
  /** Debounce interval in milliseconds. Defaults to 300. */
  debounceMs?: number
  /** Placeholder text for the input. */
  placeholder?: string
  /** ARIA label for the input. */
  ariaLabel?: string
  /**
   * Prefix for `data-testid`. Produces:
   *   `${testidPrefix}-open`  on the trigger button
   *   `${testidPrefix}-close` on the close button
   */
  testidPrefix?: string
}

/**
 * Inline expandable search affordance. Renders a 32px square trigger button
 * when collapsed; an input with a leading icon and trailing close button when
 * expanded. The trigger button is absolutely anchored to the right edge of its
 * parent so the host can animate the parent width without the icon drifting.
 *
 * Open state is controlled so the host can coordinate sibling layout (e.g.
 * fade out other action buttons while the input expands).
 */
export function ExpandableSearch(props: ExpandableSearchProps) {
  const { t } = useI18n()
  const [value, setValue] = useState(props.initialValue ?? '')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const lastReportedRef = useRef(props.initialValue ?? '')
  const debounceMs = props.debounceMs ?? 300

  useEffect(() => {
    if (!props.open) return
    inputRef.current?.focus()
  }, [props.open])

  useEffect(() => {
    if (lastReportedRef.current === value) return
    const timer = window.setTimeout(() => {
      lastReportedRef.current = value
      props.onSearch(value)
    }, debounceMs)
    return () => window.clearTimeout(timer)
  }, [value, debounceMs, props.onSearch])

  const close = () => {
    props.onOpenChange(false)
    if (value !== '') {
      setValue('')
      lastReportedRef.current = ''
      props.onSearch('')
    }
  }

  if (!props.open) {
    return (
      <Button
        aria-label={props.ariaLabel ?? t('common.search')}
        className="size-8 shrink-0"
        data-testid={
          props.testidPrefix ? `${props.testidPrefix}-open` : undefined
        }
        iconOnly
        onClick={() => props.onOpenChange(true)}
        type="button"
        variant="ghost"
      >
        <Search aria-hidden="true" className="size-4" />
      </Button>
    )
  }

  return (
    <label className="relative flex h-8 w-full items-center">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-2 size-3.5 text-fg-subtle"
      />
      <input
        aria-label={props.ariaLabel ?? t('common.search')}
        className="shadow-xs h-8 w-full rounded-sm border border-border bg-surface-card pl-7 pr-7 text-sm text-fg outline-hidden placeholder:text-fg-subtle focus:border-accent focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            close()
          }
        }}
        placeholder={props.placeholder}
        ref={inputRef}
        type="search"
        value={value}
      />
      <button
        aria-label={t('common.close')}
        className={cn(
          'absolute right-1 inline-flex size-6 items-center justify-center rounded-sm text-fg-subtle transition-colors hover:bg-surface-inset hover:text-fg',
          'focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15',
        )}
        data-testid={
          props.testidPrefix ? `${props.testidPrefix}-close` : undefined
        }
        onClick={close}
        type="button"
      >
        <X aria-hidden="true" className="size-3.5" />
      </button>
    </label>
  )
}
