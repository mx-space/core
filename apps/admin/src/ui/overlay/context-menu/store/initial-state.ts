import type { ContextMenuItem } from '../types'

export interface VirtualElement {
  contextElement?: Element
  getBoundingClientRect: () => DOMRect
}

export interface ContextMenuState {
  anchor: VirtualElement | null
  items: ContextMenuItem[]
  open: boolean
  triggerId: string | null
}

export const initialContextMenuState: ContextMenuState = {
  anchor: null,
  items: [],
  open: false,
  triggerId: null,
}
