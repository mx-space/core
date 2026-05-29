import { mergeProps } from '@base-ui/react/merge-props'
import {
  Children,
  cloneElement,
  isValidElement,
  memo,
  useCallback,
  useId,
} from 'react'
import type {
  HTMLAttributes,
  MouseEvent as ReactMouseEvent,
  ReactNode,
} from 'react'
import type { ContextMenuItem } from './types'

import { cn } from '~/utils/cn'

import { showContextMenu, useContextMenuStore } from './store'

export type ContextMenuTriggerProps = {
  children: ReactNode
  /**
   * Menu items to display. Supports lazy evaluation via function — the function
   * is called when the user invokes the menu, not on every render.
   * When provided, the context menu is shown automatically on right-click.
   */
  items?: ContextMenuItem[] | (() => ContextMenuItem[])
  /**
   * Additional handler called after the menu is shown (or instead of it,
   * when `items` is omitted).
   */
  onContextMenu?: (event: ReactMouseEvent<HTMLElement>) => void
} & Omit<HTMLAttributes<HTMLElement>, 'children' | 'onContextMenu'>

const wrapperStyle = { display: 'contents' as const }

/**
 * Marks its child as a context-menu trigger. When the child is a single
 * `ReactElement`, the trigger props are merged into it via `cloneElement`;
 * otherwise the children are wrapped in a `<span style="display:contents">`.
 *
 * While the menu opened from this trigger is visible, the element receives
 * `data-popup-open=""` and `data-state="open"` — style with the Tailwind
 * variant `data-[popup-open]:` or `data-[state=open]:`.
 */
export const ContextMenuTrigger = memo<ContextMenuTriggerProps>(
  function ContextMenuTrigger({ children, items, onContextMenu, ...rest }) {
    const triggerId = useId()
    const open = useContextMenuStore((s) => s.open && s.triggerId === triggerId)

    const handleContextMenu = useCallback(
      (event: ReactMouseEvent<HTMLElement>) => {
        if (items) {
          event.preventDefault()
          const resolved = typeof items === 'function' ? items() : items
          showContextMenu(resolved)
        }
        onContextMenu?.(event)
      },
      [items, onContextMenu],
    )

    const triggerProps = {
      ...rest,
      'aria-expanded': open || undefined,
      className: cn(rest.className),
      'data-contextmenu-trigger': triggerId,
      'data-popup-open': open ? '' : undefined,
      'data-state': open ? 'open' : undefined,
      onContextMenu: handleContextMenu,
    }

    if (isValidElement(children) && Children.only(children)) {
      const childProps = (children.props ?? {}) as Record<string, unknown>
      return cloneElement(
        children,
        mergeProps(childProps as never, triggerProps as never),
      )
    }

    return (
      <span style={wrapperStyle} {...triggerProps}>
        {children}
      </span>
    )
  },
)
