import type { StoreSetter } from '~/store/types'
import type { ContextMenuItem } from '../types'
import type { VirtualElement } from './initial-state'
import type { ContextMenuStore } from './store'

type Setter = StoreSetter<ContextMenuStore>

interface PointerSample {
  ready: boolean
  triggerId: string | null
  x: number
  y: number
}

function createVirtualElement(point: { x: number; y: number }): VirtualElement {
  return {
    contextElement: typeof document === 'undefined' ? undefined : document.body,
    getBoundingClientRect: () =>
      ({
        bottom: point.y,
        height: 0,
        left: point.x,
        right: point.x,
        toJSON: () => undefined,
        top: point.y,
        width: 0,
        x: point.x,
        y: point.y,
      }) as DOMRect,
  }
}

export class ContextMenuActionImpl {
  readonly #set: Setter
  // Pointer tracking is intentionally instance-local: it's a DOM listener
  // cache, not React state, and re-renders shouldn't depend on it.
  readonly #lastPointer: PointerSample = {
    ready: false,
    triggerId: null,
    x: 0,
    y: 0,
  }

  constructor(set: Setter, _get: () => ContextMenuStore, _api?: unknown) {
    void _get
    void _api
    this.#set = set
  }

  setContextMenuState = (next: Partial<ContextMenuStore>): void => {
    this.#set(next, false, 'setContextMenuState')
  }

  updateLastPointer = (event: MouseEvent | PointerEvent): void => {
    this.#lastPointer.x = event.clientX
    this.#lastPointer.y = event.clientY
    this.#lastPointer.ready = true
    if (event.target instanceof Element) {
      const trigger = event.target.closest<HTMLElement>(
        '[data-contextmenu-trigger]',
      )
      this.#lastPointer.triggerId = trigger?.dataset.contextmenuTrigger ?? null
    } else {
      this.#lastPointer.triggerId = null
    }
  }

  showContextMenu = (items: ContextMenuItem[]): void => {
    if (typeof window === 'undefined') return
    const fallback = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    const point = this.#lastPointer.ready
      ? { x: this.#lastPointer.x, y: this.#lastPointer.y }
      : fallback
    this.#set(
      {
        anchor: createVirtualElement(point),
        items,
        open: true,
        triggerId: this.#lastPointer.triggerId ?? null,
      },
      false,
      'showContextMenu',
    )
  }

  /**
   * Replace the items of an open menu without re-anchoring.
   * Useful when a checkbox toggles in-place.
   */
  updateContextMenuItems = (items: ContextMenuItem[]): void => {
    if (typeof window === 'undefined') return
    this.#set({ items }, false, 'updateContextMenuItems')
  }

  closeContextMenu = (): void => {
    this.#set(
      {
        anchor: null,
        items: [],
        open: false,
        triggerId: null,
      },
      false,
      'closeContextMenu',
    )
  }
}

export const createContextMenuSlice = (
  set: Setter,
  get: () => ContextMenuStore,
  api: unknown,
) => new ContextMenuActionImpl(set, get, api)

export type ContextMenuAction = Pick<
  ContextMenuActionImpl,
  keyof ContextMenuActionImpl
>
