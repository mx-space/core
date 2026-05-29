import { ContextMenu } from '@base-ui/react/context-menu'
import { memo, useEffect, useMemo } from 'react'

import {
  useFloatLayerContainer,
  useLayerZIndex,
} from '~/ui/overlay/floating-layer'
import { menuStyles } from '~/ui/overlay/menu-styles'

import { renderContextMenuItems } from './renderItems'
import {
  closeContextMenu,
  updateLastPointer,
  useContextMenuStore,
} from './store'

function preventDefaultAndStopPropagation(event: {
  preventDefault: () => void
  stopPropagation: () => void
}) {
  event.preventDefault()
  event.stopPropagation()
}

/**
 * Singleton host that renders the active context menu.
 * - Tracks the last pointer position globally so `showContextMenu(items)` can
 *   anchor without an explicit event.
 * - Each opened positioner acquires a fresh z-index from the floating-layer
 *   manager so submenus naturally stack above their parents.
 */
export const ContextMenuHost = memo(function ContextMenuHost() {
  const state = useContextMenuStore((s) => ({
    anchor: s.anchor,
    items: s.items,
    open: s.open,
  }))
  const setContextMenuState = useContextMenuStore((s) => s.setContextMenuState)
  const { ref: zRef, zIndex } = useLayerZIndex<HTMLDivElement>('floating')
  const container = useFloatLayerContainer()

  useEffect(() => {
    const handler = (event: MouseEvent | PointerEvent) => {
      updateLastPointer(event)
    }
    window.addEventListener('pointerdown', handler, true)
    window.addEventListener('contextmenu', handler, true)
    return () => {
      window.removeEventListener('pointerdown', handler, true)
      window.removeEventListener('contextmenu', handler, true)
    }
  }, [])

  const menuItems = useMemo(
    () => renderContextMenuItems(state.items),
    [state.items],
  )

  if (!state.open && state.items.length === 0) return null

  return (
    <ContextMenu.Root
      onOpenChange={(open) => {
        if (open) {
          setContextMenuState({ open })
          return
        }
        closeContextMenu()
      }}
      open={state.open}
    >
      <ContextMenu.Portal container={container ?? undefined}>
        <ContextMenu.Positioner
          anchor={state.anchor ?? undefined}
          ref={zRef}
          sideOffset={6}
          style={{ zIndex }}
        >
          <ContextMenu.Popup
            className={menuStyles.popup}
            onContextMenu={preventDefaultAndStopPropagation}
          >
            {menuItems}
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  )
})
