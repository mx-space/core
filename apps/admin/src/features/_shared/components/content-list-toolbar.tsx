import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'
import type { FormEventHandler, ReactNode } from 'react'

import { useI18n } from '~/i18n'
import { DropdownMenu } from '~/ui/overlay/dropdown-menu'
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
      {selection ? (
        <ContentListToolbarSelectionControls
          hasSelection={hasSelection}
          selection={selection}
        />
      ) : null}

      <form
        className="relative flex h-full min-w-0 flex-1 items-center self-stretch"
        onSubmit={props.onSearch}
      >
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400"
        />
        <input
          className={cn(
            'outline-hidden focus:outline-hidden h-7 w-full border-0 bg-transparent pl-8 text-xs text-neutral-900 placeholder:text-neutral-400 focus:ring-0 dark:text-neutral-100',
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
        className="inline-flex h-7 shrink-0 cursor-pointer items-center justify-center text-neutral-500 transition-colors hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-neutral-50"
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
      <label className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded pr-2 text-xs tabular-nums text-neutral-700 dark:text-neutral-200">
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

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        aria-label={t('shared.sortMenu.label')}
        className={cn(
          'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-sm px-2 text-xs text-fg-muted transition-colors hover:bg-surface-inset hover:text-fg focus-visible:ring-[3px] focus-visible:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-60 data-[popup-open]:bg-surface-inset',
          props.className,
        )}
        disabled={props.disabled}
        type="button"
      >
        <ArrowUpDown aria-hidden="true" className="size-3.5 text-fg-subtle" />
        <span className="truncate">
          {activeOption?.label ?? t('shared.sortMenu.label')}
        </span>
        <OrderIcon aria-hidden="true" className="size-3 text-fg-subtle" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" className="w-48">
        <DropdownMenu.GroupLabel>
          {t('shared.sortMenu.field')}
        </DropdownMenu.GroupLabel>
        {props.options.map((option) => {
          const active = option.value === props.field
          return (
            <DropdownMenu.Item
              className={cn(active ? 'font-medium text-fg' : 'text-fg-muted')}
              key={String(option.value)}
              onClick={() =>
                props.onChange({ field: option.value, order: props.order })
              }
            >
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              {active ? (
                <span className="text-accent" aria-hidden="true">
                  ●
                </span>
              ) : null}
            </DropdownMenu.Item>
          )
        })}
        <DropdownMenu.Separator />
        <DropdownMenu.GroupLabel>
          {t('shared.sortMenu.direction')}
        </DropdownMenu.GroupLabel>
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
            onClick={() => props.onChange({ field: props.field, order: 'asc' })}
          />
        </div>
      </DropdownMenu.Content>
    </DropdownMenu>
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
        'inline-flex h-7 items-center justify-center gap-1.5 rounded-sm border text-xs transition-colors',
        props.active
          ? 'border-fg bg-fg text-surface-page'
          : 'border-border bg-surface-card text-fg-muted hover:bg-surface-inset',
      )}
      onClick={props.onClick}
      type="button"
    >
      {props.icon}
      <span>{props.label}</span>
    </button>
  )
}
