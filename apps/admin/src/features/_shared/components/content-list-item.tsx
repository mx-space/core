import { ExternalLink, MoreHorizontal, Pencil } from 'lucide-react'
import { forwardRef } from 'react'
import { Link } from 'react-router'
import type { ContextMenuItem } from '~/ui/overlay/context-menu'
import type {
  ComponentPropsWithoutRef,
  MouseEvent as ReactMouseEvent,
  ReactNode,
  Ref,
} from 'react'

import { useI18n } from '~/i18n'
import { ListRow } from '~/ui/list-actions'
import { showContextMenu } from '~/ui/overlay/context-menu'
import { Checkbox } from '~/ui/primitives/checkbox'
import { cn } from '~/utils/cn'

export type ContentEntrySelectMode = 'single' | 'toggle' | 'range'

export interface ContentEntryListItemProps {
  checkboxLabel?: string
  className?: string
  /** Stable id of the underlying entity. */
  dataId?: string
  editTitle: string
  editTo: string
  externalHref: string
  /** Visual leading slot rendered inline with the title (icon, pin, etc.). */
  leading?: ReactNode
  menuItems: ContextMenuItem[] | (() => ContextMenuItem[])
  meta?: ReactNode
  onSelect?: (mode: ContentEntrySelectMode) => void
  onSelectedChange?: (checked: boolean) => void
  openTitle: string
  selected?: boolean
  status?: ReactNode
  title: ReactNode
  titleTo: string
}

/**
 * Two-line list item shared by `/posts` and `/notes`.
 *
 *   ☐  [leading]  Title text                 [status]   ✎  ↗  ⋯
 *       category · tags · 👁 N · ♡ N                       relative time
 *
 * Delegates row keyboard/selection/context-menu plumbing to `ListRow`. Owns the
 * checkbox column + title link + status badge + meta line + edit/external/more
 * action button trio.
 *
 * Note: `props.leading` is the *visual* leading slot rendered next to the title
 * (e.g. a pin icon). It is distinct from `ListRow.leading`, which holds the
 * selection-column checkbox.
 */
export function ContentEntryListItem(props: ContentEntryListItemProps) {
  const { t } = useI18n()
  const selectable = Boolean(props.checkboxLabel && props.onSelectedChange)
  const handleSelectedChange = props.onSelectedChange ?? (() => {})

  const onMoreClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    const resolved =
      typeof props.menuItems === 'function'
        ? props.menuItems()
        : props.menuItems
    showContextMenu(resolved)
  }

  return (
    <ListRow
      as="article"
      className={cn(
        'group grid cursor-default gap-x-3 gap-y-1.5 px-4 py-3',
        selectable
          ? 'grid-cols-[auto_minmax(0,1fr)_auto]'
          : 'grid-cols-[minmax(0,1fr)_auto]',
        'hover:bg-neutral-50 dark:hover:bg-neutral-900/50',
        'data-popup-open:bg-neutral-100 dark:data-popup-open:bg-neutral-800/60',
        'data-selected:bg-neutral-100 dark:data-selected:bg-neutral-800/60',
        'data-selected:hover:bg-neutral-200/60 dark:data-selected:hover:bg-neutral-800/80',
        'data-selected:data-popup-open:bg-neutral-200 dark:data-selected:data-popup-open:bg-neutral-800',
        'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-neutral-400 dark:focus-visible:outline-neutral-500',
        props.className,
      )}
      dataId={props.dataId ?? ''}
      leading={
        selectable ? (
          <Checkbox
            aria-label={props.checkboxLabel}
            checked={props.selected ?? false}
            className="mt-0.5"
            onCheckedChange={handleSelectedChange}
          />
        ) : null
      }
      menuItems={props.menuItems}
      onSelect={props.onSelect}
      selected={props.selected}
    >
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          {props.leading}
          <Link
            className="outline-hidden min-w-0 truncate text-sm font-medium text-neutral-950 hover:text-neutral-600 focus-visible:ring-2 focus-visible:ring-[var(--color-primary-shallow)] dark:text-neutral-50 dark:hover:text-neutral-300"
            to={props.titleTo}
          >
            {props.title}
          </Link>
          {props.status}
        </div>
        {props.meta ? (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
            {props.meta}
          </div>
        ) : null}
      </div>

      <div
        className={cn(
          'row-start-1 flex shrink-0 items-center gap-0.5 self-start text-neutral-300',
          'group-hover:text-neutral-600 group-data-[popup-open]:text-neutral-600 group-data-[selected]:text-neutral-600',
          'dark:text-neutral-700 dark:group-hover:text-neutral-300 dark:group-data-[popup-open]:text-neutral-300 dark:group-data-[selected]:text-neutral-300',
          selectable ? 'col-start-3' : 'col-start-2',
        )}
      >
        <ActionLink title={props.editTitle} to={props.editTo}>
          <Pencil aria-hidden="true" className="size-4" />
        </ActionLink>
        <ActionLink
          href={props.externalHref}
          rel="noreferrer"
          target="_blank"
          title={props.openTitle}
        >
          <ExternalLink aria-hidden="true" className="size-4" />
        </ActionLink>
        <ActionButton
          onClick={onMoreClick}
          title={t('shared.contentListItem.moreActions')}
        >
          <MoreHorizontal aria-hidden="true" className="size-4" />
        </ActionButton>
      </div>
    </ListRow>
  )
}

const actionSlotClassName =
  'outline-hidden inline-flex h-7 w-7 items-center justify-center rounded text-current no-underline hover:bg-neutral-100 hover:text-neutral-950 focus-visible:ring-2 focus-visible:ring-[var(--color-primary-shallow)] dark:hover:bg-neutral-800 dark:hover:text-neutral-50'

type ActionLinkProps =
  | ({ href: string; to?: never } & Omit<
      ComponentPropsWithoutRef<'a'>,
      'className'
    >)
  | ({ href?: never; to: string } & Omit<
      ComponentPropsWithoutRef<typeof Link>,
      'className' | 'to'
    >)

function ActionLink(
  props: ActionLinkProps & { children: ReactNode; title: string },
) {
  const { children, title } = props
  if ('to' in props && props.to) {
    return (
      <Link
        aria-label={title}
        className={actionSlotClassName}
        onClick={(event) => event.stopPropagation()}
        title={title}
        to={props.to}
      >
        {children}
      </Link>
    )
  }
  const {
    children: _c,
    title: _t,
    to: _to,
    ...rest
  } = props as {
    children: ReactNode
    title: string
    to?: undefined
  } & ComponentPropsWithoutRef<'a'>
  return (
    <a
      aria-label={title}
      className={actionSlotClassName}
      onClick={(event) => event.stopPropagation()}
      title={title}
      {...rest}
    >
      {children}
    </a>
  )
}

interface ActionButtonProps extends Omit<
  ComponentPropsWithoutRef<'button'>,
  'className'
> {
  title: string
}

const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(
  function ActionButton(
    { children, title, ...rest },
    ref: Ref<HTMLButtonElement>,
  ) {
    return (
      <button
        aria-label={title}
        className={actionSlotClassName}
        ref={ref}
        title={title}
        type="button"
        {...rest}
      >
        {children}
      </button>
    )
  },
)

export function ContentListStatusBadge(props: {
  active: boolean
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'shrink-0 rounded px-1.5 py-0.5 text-xs leading-4',
        props.active
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
          : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400',
      )}
    >
      {props.children}
    </span>
  )
}
