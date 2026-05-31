import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react'

import type { ContextMenuItem } from '~/ui/overlay/context-menu'
import { ContextMenuTrigger } from '~/ui/overlay/context-menu'
import { cn } from '~/utils/cn'

export type ListRowSelectMode = 'single' | 'toggle' | 'range'

export interface ListRowProps {
  /** Stable non-empty id. Emitted as data-id; consumed by selection + arrow-nav. */
  dataId: string
  /** Explicit (checked) selection state. Drives data-selected and aria-selected. */
  selected?: boolean
  /**
   * Implicit cursor state — true when this row is the most recent arrow-nav
   * / row-body-click target inside its scope. Drives `data-cursor` and a
   * baseline accent left-bar so the row is distinguishable from explicit
   * (checkbox-checked) rows. Disappears when the scope is deactivated.
   */
  cursor?: boolean
  /**
   * Whether this row is the master-detail "current" row. Renders
   * aria-current="true" in addition to aria-selected.
   */
  ariaCurrent?: boolean
  /**
   * Click on the row body away from interactive descendants. `mode` is derived
   * from modifier keys: Shift → range, ⌘/Ctrl → toggle, else single.
   */
  onSelect?: (mode: ListRowSelectMode) => void
  /** Context-menu items. Omit to disable context menu. */
  menuItems?: ContextMenuItem[] | (() => ContextMenuItem[])
  /** Leading slot rendered before children — typically a checkbox column. */
  leading?: ReactNode
  /** Tag name. Defaults to article. */
  as?: 'article' | 'div' | 'li'
  /**
   * Accessibility role. Pass `'option'` if hosted in role=listbox, `'row'`
   * if hosted in role=grid, otherwise leave unset.
   */
  role?: 'option' | 'row' | 'listitem'
  className?: string
  children: ReactNode
}

/**
 * Interactive descendants that should not trigger row `onSelect` when clicked.
 * Exported so feature rows can extend or audit it.
 */
export const LIST_ROW_INTERACTIVE_SELECTOR =
  'a[href], button, input, textarea, select, [role="menuitem"], [role="checkbox"], [role="button"], [role="link"], [contenteditable=""], [contenteditable="true"]'

/**
 * Business-agnostic row primitive. Owns the keyboard/selection/context-menu
 * DOM contract; visual content lives in `children` and `leading`.
 *
 * - Emits `data-scope-item="row"` so `useScopeArrowNav` can find it.
 * - Emits `data-id={dataId}` for selection key resolution.
 * - Reflects `selected` via `data-selected` + `aria-selected`.
 * - Wraps in `<ContextMenuTrigger>` when `menuItems` is supplied; the trigger
 *   merges `data-contextmenu-trigger`, `aria-expanded`, `data-popup-open`, and
 *   `data-state` onto the row element.
 * - Click handler classifies modifier keys into single/toggle/range and ignores
 *   clicks on interactive descendants (see `LIST_ROW_INTERACTIVE_SELECTOR`).
 * - Keyboard activation (Enter/Space) is intentionally NOT handled here.
 *   Action registries (see `buildPostActions` etc.) own those bindings via
 *   `useListShortcuts`, gated on the active focus scope.
 */
export function ListRow(props: ListRowProps) {
  const {
    ariaCurrent,
    as = 'article',
    children,
    className,
    cursor,
    dataId,
    leading,
    menuItems,
    onSelect,
    role,
    selected,
  } = props

  if (import.meta.env.DEV && (!dataId || dataId.trim() === '')) {
    throw new Error(
      '[ListRow] `dataId` must be a non-empty string. Got: ' +
        JSON.stringify(dataId),
    )
  }

  const onClick = (event: ReactMouseEvent<HTMLElement>) => {
    if (event.defaultPrevented) return
    if (!onSelect) return
    const target = event.target as Element | null
    if (target?.closest(LIST_ROW_INTERACTIVE_SELECTOR)) return
    const mode: ListRowSelectMode = event.shiftKey
      ? 'range'
      : event.metaKey || event.ctrlKey
        ? 'toggle'
        : 'single'
    onSelect(mode)
  }

  const Tag = as
  const body = (
    <Tag
      aria-current={ariaCurrent ? 'true' : undefined}
      aria-selected={selected ? true : undefined}
      className={cn(
        'outline-hidden relative',
        // Baseline cursor indicator: a thin accent bar on the left edge.
        // Feature-row classNames can override or add to this without losing
        // the cursor visual because pseudo-elements layer above background.
        'data-cursor:before:absolute data-cursor:before:left-0 data-cursor:before:top-0 data-cursor:before:h-full data-cursor:before:w-0.5 data-cursor:before:bg-accent data-cursor:before:content-[""]',
        className,
      )}
      data-cursor={cursor ? '' : undefined}
      data-id={dataId || undefined}
      data-scope-item="row"
      data-selected={selected ? '' : undefined}
      onClick={onClick}
      role={role}
      tabIndex={-1}
    >
      {leading}
      {children}
    </Tag>
  )

  if (!menuItems) return body
  return <ContextMenuTrigger items={menuItems}>{body}</ContextMenuTrigger>
}
