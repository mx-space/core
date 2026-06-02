import { motion, useReducedMotion } from 'motion/react'
import { useId } from 'react'

import { cn } from '~/utils/cn'

export interface TabListItem<K extends string> {
  key: K
  label: string
  /** Optional numeric count rendered next to the label. */
  count?: number
}

export interface TabListProps<K extends string> {
  items: ReadonlyArray<TabListItem<K>>
  activeKey: K
  onSelect: (key: K) => void
  /** ARIA label for the tablist container. */
  ariaLabel?: string
  /** Optional className appended to the container. */
  className?: string
  /**
   * Prefix for per-item `data-testid` attributes:
   *   tab button → `${testidPrefix}-${key}`
   *   count pill → `${testidPrefix}-count-${key}`
   *   active pill indicator → `${testidPrefix}-indicator`
   */
  testidPrefix?: string
  /** ARIA controls id pattern — applied per tab as `${ariaControlsId}-panel`. */
  ariaControlsId?: string
  /**
   * Optional explicit id for the shared motion layoutId behind the
   * active-tab pill indicator. When omitted, a stable id is generated via
   * React.useId() so multiple TabList instances on the same route do not
   * collide.
   */
  indicatorId?: string
}

function formatCount(n: number) {
  if (n <= 0) return null
  return n > 99 ? '99+' : String(n)
}

/**
 * Inbox-style tab strip with optional numeric counts. Active state is a soft
 * inset pill (`bg-surface-inset`) that animates between tabs via a shared
 * motion `layoutId`. 48px row, 32px pill (inset-y-2). Horizontally
 * scrollable (scrollbar hidden) so it stacks predictably with sibling
 * controls.
 *
 * Generic over a string key union so consumers retain type-safety on
 * activeKey / onSelect.
 */
export function TabList<K extends string>(props: TabListProps<K>) {
  const autoId = useId()
  const indicatorId = props.indicatorId ?? `tablist-indicator-${autoId}`
  const reducedMotion = useReducedMotion()

  return (
    <div
      aria-label={props.ariaLabel}
      className={cn(
        'relative flex h-full min-w-0 flex-1 items-stretch overflow-x-auto',
        '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        props.className,
      )}
      role="tablist"
    >
      {props.items.map((item) => {
        const isActive = item.key === props.activeKey
        const countLabel = formatCount(item.count ?? 0)
        return (
          <button
            aria-controls={
              props.ariaControlsId ? `${props.ariaControlsId}-panel` : undefined
            }
            aria-selected={isActive}
            className={cn(
              'relative inline-flex h-full shrink-0 items-center gap-1.5 px-3 text-sm transition-colors',
              'focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15',
              isActive ? 'text-fg' : 'text-fg-muted hover:text-fg',
            )}
            data-active={isActive ? '' : undefined}
            data-testid={
              props.testidPrefix
                ? `${props.testidPrefix}-${item.key}`
                : undefined
            }
            key={item.key}
            onClick={() => props.onSelect(item.key)}
            role="tab"
            type="button"
          >
            {isActive ? (
              <motion.span
                aria-hidden="true"
                className="absolute inset-x-0 inset-y-2 rounded-sm bg-surface-inset"
                data-testid={
                  props.testidPrefix
                    ? `${props.testidPrefix}-indicator`
                    : undefined
                }
                layoutId={indicatorId}
                transition={
                  reducedMotion
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 380, damping: 32 }
                }
              />
            ) : null}
            <span className="relative z-10">{item.label}</span>
            {countLabel ? (
              <span
                className={cn(
                  'relative z-10 text-xs font-medium tabular-nums',
                  isActive ? 'text-accent' : 'text-fg-subtle',
                )}
                data-testid={
                  props.testidPrefix
                    ? `${props.testidPrefix}-count-${item.key}`
                    : undefined
                }
              >
                {countLabel}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
