import { Popover } from '@base-ui/react/popover'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'
import type { FormEventHandler, ReactNode } from 'react'
import { useEffect } from 'react'

import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import { PortalLayerScope, useFloatingZ } from '~/ui/feedback/portal-layer'
import { MobileHamburger } from '~/ui/layout/mobile-hamburger'
import { useShellNav } from '~/ui/layout/shell-nav-context'
import { Checkbox } from '~/ui/primitives/checkbox'
import { cn } from '~/utils/cn'

interface ContentListToolbarSelection {
  allVisibleSelected: boolean
  bulkActionDisabled?: boolean
  bulkActionIcon?: ReactNode
  bulkActionLabel: string
  hasVisibleItems: boolean
  indeterminate: boolean
  onBulkAction: () => void
  onToggleAllVisible: (checked: boolean) => void
  selectAllLabel: string
  selectedCount: number
  selectedLabel: string
}

interface ContentListToolbarProps {
  className?: string
  extraActions?: ReactNode
  filters?: ReactNode
  hasSearch: boolean
  onClearSearch: () => void
  onSearch: FormEventHandler<HTMLFormElement>
  onSearchValueChange: (value: string) => void
  searchPlaceholder: string
  searchValue: string
  selection?: ContentListToolbarSelection
  sortMenu?: ReactNode
}

export function ContentListHeader(props: {
  action?: ReactNode
  className?: string
  count?: ReactNode
  icon: ReactNode
  title: ReactNode
}) {
  const shellNav = useShellNav()
  const registerPageHeader = shellNav?.registerPageHeader
  useEffect(() => registerPageHeader?.(), [registerPageHeader])

  return (
    <header
      className={cn(
        'flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 dark:border-neutral-800 dark:bg-neutral-950',
        APP_SHELL_HEADER_HEIGHT_CLASS,
        props.className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <MobileHamburger />
        <span className="inline-flex size-7 shrink-0 items-center justify-center border border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
          {props.icon}
        </span>
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className="truncate text-lg font-semibold text-neutral-950 dark:text-neutral-50">
            {props.title}
          </h2>
          {props.count != null ? (
            <span className="shrink-0 text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
              {props.count}
            </span>
          ) : null}
        </div>
      </div>
      {props.action ? (
        <div className="flex shrink-0 items-center gap-2">{props.action}</div>
      ) : null}
    </header>
  )
}

export function ContentListToolbar(props: ContentListToolbarProps) {
  const { t } = useI18n()
  const selection = props.selection
  const selectedCount = selection?.selectedCount ?? 0
  const hasSelection = selectedCount > 0

  return (
    <div
      className={cn(
        'flex h-10 shrink-0 items-center gap-1.5 border-b border-neutral-200 bg-white px-4 dark:border-neutral-800 dark:bg-neutral-950',
        props.className,
      )}
    >
      <form
        className="relative flex h-full min-w-0 flex-1 items-center self-stretch"
        onSubmit={props.onSearch}
      >
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400"
        />
        <input
          className={cn(
            'outline-hidden focus:outline-hidden h-7 w-full border-0 bg-transparent pl-6 text-xs text-neutral-900 placeholder:text-neutral-400 focus:ring-0 dark:text-neutral-100',
            props.hasSearch ? 'pr-6' : 'pr-0',
          )}
          onChange={(event) => props.onSearchValueChange(event.target.value)}
          placeholder={props.searchPlaceholder}
          type="text"
          value={props.searchValue}
        />
        {props.hasSearch ? (
          <button
            aria-label={t('shared.contentListToolbar.clearSearch')}
            className="absolute right-3 top-1/2 inline-flex size-4 -translate-y-1/2 items-center justify-center rounded text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            onClick={props.onClearSearch}
            type="button"
          >
            <X aria-hidden="true" className="size-3" />
          </button>
        ) : null}
      </form>

      {props.filters ? (
        <div className="flex shrink-0 items-center gap-1.5">
          {props.filters}
        </div>
      ) : null}

      {props.sortMenu}

      {props.extraActions ? (
        <>
          <span
            aria-hidden="true"
            className="h-3.5 w-px shrink-0 bg-neutral-200 dark:bg-neutral-800"
          />
          <div className="flex shrink-0 items-center gap-1.5">
            {props.extraActions}
          </div>
        </>
      ) : null}

      {selection ? (
        <ContentListToolbarSelectionControls
          hasSelection={hasSelection}
          selection={selection}
        />
      ) : null}
    </div>
  )
}

export function ContentListRefreshButton(props: {
  isFetching: boolean
  label: string
  onRefresh: () => void
}) {
  return (
    <button
      aria-label={props.label}
      className="outline-hidden inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-[var(--color-primary-shallow)] disabled:pointer-events-none disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
      disabled={props.isFetching}
      onClick={props.onRefresh}
      type="button"
    >
      <RefreshCw
        aria-hidden="true"
        className={cn('size-3.5', props.isFetching && 'animate-spin')}
      />
    </button>
  )
}

function ContentListToolbarSelectionControls(props: {
  hasSelection: boolean
  selection: ContentListToolbarSelection
}) {
  const { hasSelection, selection } = props

  if (!hasSelection) {
    if (!selection.hasVisibleItems) return null
    return (
      <label
        aria-label={selection.selectAllLabel}
        className="inline-flex h-7 shrink-0 cursor-pointer items-center justify-center px-1 text-neutral-500 transition-colors hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-neutral-50"
        title={selection.selectAllLabel}
      >
        <Checkbox
          aria-label={selection.selectAllLabel}
          checked={selection.allVisibleSelected}
          indeterminate={selection.indeterminate}
          onCheckedChange={selection.onToggleAllVisible}
        />
      </label>
    )
  }

  return (
    <>
      <label className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded bg-neutral-100 px-2 text-xs tabular-nums text-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
        <Checkbox
          aria-label={selection.selectAllLabel}
          checked={selection.allVisibleSelected}
          indeterminate={selection.indeterminate}
          onCheckedChange={selection.onToggleAllVisible}
        />
        <span>{selection.selectedLabel}</span>
      </label>
      <button
        className="outline-hidden inline-flex h-7 shrink-0 items-center gap-1.5 rounded border border-red-200 bg-red-50/60 px-2 text-xs text-red-700 transition-colors hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-[var(--color-primary-shallow)] disabled:pointer-events-none disabled:opacity-50 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50"
        disabled={selection.bulkActionDisabled}
        onClick={selection.onBulkAction}
        type="button"
      >
        {selection.bulkActionIcon}
        <span>{selection.bulkActionLabel}</span>
      </button>
    </>
  )
}

interface SortMenuProps<TField extends string = string> {
  className?: string
  disabled?: boolean
  field: TField
  options: ReadonlyArray<{ label: ReactNode; value: TField }>
  order: 'asc' | 'desc'
  onChange: (next: { field: TField; order: 'asc' | 'desc' }) => void
}

export function SortMenu<TField extends string = string>(
  props: SortMenuProps<TField>,
) {
  const { t } = useI18n()
  const activeOption = props.options.find(
    (option) => option.value === props.field,
  )
  const OrderIcon = props.order === 'asc' ? ArrowUp : ArrowDown
  const { z, depth } = useFloatingZ('popover')

  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={t('shared.sortMenu.label')}
        className={cn(
          'outline-hidden inline-flex h-7 shrink-0 items-center gap-1.5 rounded px-2 text-xs text-neutral-700 transition-colors hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-[var(--color-primary-shallow)] disabled:cursor-not-allowed disabled:opacity-60 data-[popup-open]:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-900 dark:data-[popup-open]:bg-neutral-900',
          props.className,
        )}
        disabled={props.disabled}
        type="button"
      >
        <ArrowUpDown aria-hidden="true" className="size-3.5 text-neutral-400" />
        <span className="truncate">
          {activeOption?.label ?? t('shared.sortMenu.label')}
        </span>
        <OrderIcon aria-hidden="true" className="size-3 text-neutral-400" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          align="end"
          side="bottom"
          sideOffset={6}
          style={{ zIndex: z }}
        >
          <PortalLayerScope depth={depth}>
            <Popover.Popup className="outline-hidden w-48 rounded border border-neutral-200 bg-white p-1 text-xs shadow-lg dark:border-neutral-800 dark:bg-neutral-950">
              <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                {t('shared.sortMenu.field')}
              </div>
              {props.options.map((option) => {
                const active = option.value === props.field
                return (
                  <button
                    className={cn(
                      'outline-hidden flex w-full items-center justify-between rounded px-2 py-1.5 text-left transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800',
                      active
                        ? 'font-medium text-neutral-950 dark:text-neutral-50'
                        : 'text-neutral-600 dark:text-neutral-300',
                    )}
                    key={String(option.value)}
                    onClick={() =>
                      props.onChange({
                        field: option.value,
                        order: props.order,
                      })
                    }
                    type="button"
                  >
                    <span className="truncate">{option.label}</span>
                    {active ? (
                      <span className="text-[var(--color-primary)]">●</span>
                    ) : null}
                  </button>
                )
              })}
              <div className="mx-1 my-1 border-t border-neutral-100 dark:border-neutral-800" />
              <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                {t('shared.sortMenu.direction')}
              </div>
              <div className="grid grid-cols-2 gap-1 p-1">
                <SortOrderButton
                  active={props.order === 'desc'}
                  icon={<ArrowDown aria-hidden="true" className="size-3.5" />}
                  label={t('shared.sortMenu.desc')}
                  onClick={() =>
                    props.onChange({ field: props.field, order: 'desc' })
                  }
                />
                <SortOrderButton
                  active={props.order === 'asc'}
                  icon={<ArrowUp aria-hidden="true" className="size-3.5" />}
                  label={t('shared.sortMenu.asc')}
                  onClick={() =>
                    props.onChange({ field: props.field, order: 'asc' })
                  }
                />
              </div>
            </Popover.Popup>
          </PortalLayerScope>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

function SortOrderButton(props: {
  active: boolean
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      className={cn(
        'inline-flex h-7 items-center justify-center gap-1.5 rounded border text-xs transition-colors',
        props.active
          ? 'border-neutral-950 bg-neutral-950 text-white dark:border-neutral-50 dark:bg-neutral-50 dark:text-neutral-950'
          : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-900',
      )}
      onClick={props.onClick}
      type="button"
    >
      {props.icon}
      <span>{props.label}</span>
    </button>
  )
}
