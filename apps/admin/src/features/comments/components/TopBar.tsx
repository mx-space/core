import { Filter, RefreshCw } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import type { ReactNode } from 'react'
import { useState } from 'react'

import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import { Popover } from '~/ui/overlay/popover'
import { ExpandableSearch } from '~/ui/patterns/ExpandableSearch'
import type { TabListItem } from '~/ui/patterns/TabList'
import { TabList } from '~/ui/patterns/TabList'
import { Button } from '~/ui/primitives/button'
import { cn } from '~/utils/cn'

export type CommentDensity = 'compact' | 'cozy' | 'rich'

export type TopBarTab<K extends string = string> = TabListItem<K>

export interface TopBarProps<K extends string = string> {
  tabs: ReadonlyArray<TopBarTab<K>>
  activeKey: K
  onSelect: (key: K) => void
  onRefresh?: () => void
  onSearch?: (value: string) => void
  initialSearch?: string
  searchPlaceholder?: string
  isRefreshing?: boolean
  /** Whether a filter (refType / refId / source) is currently active. */
  filterActive?: boolean
  /** Popover content for the filter button. Omit to hide the filter button. */
  filterContent?: ReactNode
}

const FADE_TRANSITION = { duration: 0.14, ease: 'easeOut' } as const

export function TopBar<K extends string = string>(props: TopBarProps<K>) {
  const { t } = useI18n()
  const [searchOpen, setSearchOpen] = useState(Boolean(props.initialSearch))
  const [filterOpen, setFilterOpen] = useState(false)

  return (
    <div
      className={cn(
        'flex shrink-0 items-stretch gap-2 px-3',
        APP_SHELL_HEADER_HEIGHT_CLASS,
      )}
      data-testid="comments-topbar"
    >
      <AnimatePresence initial={false} mode="popLayout">
        {!searchOpen ? (
          <motion.div
            animate={{ opacity: 1 }}
            className="flex min-w-0 flex-1 items-stretch"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            key="tabs"
            layout
            transition={FADE_TRANSITION}
          >
            <TabList<K>
              activeKey={props.activeKey}
              ariaLabel={t('comments.filter.label')}
              items={props.tabs}
              onSelect={props.onSelect}
              testidPrefix="comments-tab"
            />
          </motion.div>
        ) : null}

        {!searchOpen ? (
          <motion.div
            animate={{ opacity: 1 }}
            className="flex shrink-0 items-center gap-1"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            key="side-actions"
            layout
            transition={FADE_TRANSITION}
          >
            {props.onRefresh ? (
              <Button
                aria-label={t('comments.topbar.refresh')}
                data-testid="comments-topbar-refresh"
                disabled={props.isRefreshing}
                iconOnly
                onClick={() => props.onRefresh?.()}
                title={t('comments.topbar.refresh')}
                type="button"
                variant="ghost"
              >
                <RefreshCw
                  aria-hidden="true"
                  className={cn('size-4', props.isRefreshing && 'animate-spin')}
                />
              </Button>
            ) : null}

            {props.filterContent ? (
              <Popover onOpenChange={setFilterOpen} open={filterOpen}>
                <Popover.Trigger
                  aria-label={t('comments.filter.label')}
                  className={cn(
                    'relative inline-flex size-8 items-center justify-center rounded-sm text-fg-muted transition-colors hover:bg-surface-inset hover:text-fg',
                    'focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15',
                    props.filterActive && 'text-accent',
                  )}
                  data-testid="comments-topbar-filter"
                  type="button"
                >
                  <Filter aria-hidden="true" className="size-4" />
                  {props.filterActive ? (
                    <span
                      aria-hidden="true"
                      className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-accent"
                    />
                  ) : null}
                </Popover.Trigger>
                <Popover.Content
                  align="end"
                  className="p-3"
                  sideOffset={6}
                  width="auto"
                >
                  {props.filterContent}
                </Popover.Content>
              </Popover>
            ) : null}
          </motion.div>
        ) : null}

        <div
          className={cn(
            'relative flex h-full items-center',
            searchOpen ? 'min-w-0 flex-1' : 'w-8 shrink-0',
          )}
          key="search-zone"
        >
          <ExpandableSearch
            ariaLabel={t('comments.search.openLabel')}
            initialValue={props.initialSearch}
            onOpenChange={setSearchOpen}
            onSearch={(value) => props.onSearch?.(value)}
            open={searchOpen}
            placeholder={
              props.searchPlaceholder ?? t('comments.search.placeholder')
            }
            testidPrefix="comments-search"
          />
        </div>
      </AnimatePresence>
    </div>
  )
}
