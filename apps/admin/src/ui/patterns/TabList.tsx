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
   */
  testidPrefix?: string
  /** ARIA controls id pattern — applied per tab as `${ariaControlsId}-panel`. */
  ariaControlsId?: string
}

function formatCount(n: number) {
  if (n <= 0) return null
  return n > 99 ? '99+' : String(n)
}

/**
 * Inbox-style tab strip with optional numeric counts. Underline-on-active,
 * horizontally scrollable (scrollbar hidden), 32px (h-8) row height so it
 * stacks predictably with sibling controls.
 *
 * Generic over a string key union so consumers retain type-safety on
 * activeKey / onSelect.
 */
export function TabList<K extends string>(props: TabListProps<K>) {
  return (
    <div
      aria-label={props.ariaLabel}
      className={cn(
        'flex h-full min-w-0 flex-1 items-stretch overflow-x-auto',
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
              'inline-flex h-full shrink-0 items-center gap-1 border-b-2 px-2 text-sm transition-colors',
              'focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15',
              isActive
                ? 'border-accent font-semibold text-fg'
                : 'border-transparent text-fg-muted hover:text-fg',
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
            <span>{item.label}</span>
            {countLabel ? (
              <span
                className={cn(
                  'text-xs font-medium tabular-nums',
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
