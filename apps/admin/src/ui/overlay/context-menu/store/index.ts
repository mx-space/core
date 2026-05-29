import type { ContextMenuItem } from '../types'

import { useContextMenuStore } from './store'

export type { ContextMenuAction } from './action'
export type { ContextMenuState, VirtualElement } from './initial-state'
export type { ContextMenuStore } from './store'
export { getContextMenuStoreState, useContextMenuStore } from './store'

/* Imperative API — thin wrappers callable outside React. */

export function showContextMenu(items: ContextMenuItem[]): void {
  useContextMenuStore.getState().showContextMenu(items)
}

export function updateContextMenuItems(items: ContextMenuItem[]): void {
  useContextMenuStore.getState().updateContextMenuItems(items)
}

export function closeContextMenu(): void {
  useContextMenuStore.getState().closeContextMenu()
}

export function updateLastPointer(event: MouseEvent | PointerEvent): void {
  useContextMenuStore.getState().updateLastPointer(event)
}
