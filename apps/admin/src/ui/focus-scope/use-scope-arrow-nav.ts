import { useEffect, useRef } from 'react'
import type { KeybindingsMap } from 'tinykeys'
import { tinykeys } from 'tinykeys'

import { isItemVisible, isTextInputTarget } from './dom-utils'
import { getActiveScopeId, setLastFocusedItem } from './hooks'

export interface UseScopeArrowNavOptions {
  /** The focus-scope id whose items this set navigates. */
  scopeId: string
  /** CSS selector matching the navigable items inside the scope. */
  itemSelector: string
  /** Disable bindings. */
  enabled?: boolean
  /**
   * Called after focus moves to a new item via keyboard. Receives the newly
   * focused element. Consumers commonly use this to mirror the focus cursor
   * into their own selection state (e.g. `selection.selectOne(el.dataset.id)`).
   */
  onItemFocus?: (target: HTMLElement) => void
  /**
   * Extra keybindings merged into the same tinykeys map. Gated identically
   * (scope active + non-text-input target). Use for scope-local extras like
   * fold-toggle (`z`/`Space` on a sidebar).
   */
  extra?: KeybindingsMap
}

/**
 * Module-level guard against double-fire when the same component (and thus
 * the same `useScopeArrowNav` hook) mounts more than once for one logical
 * region — e.g. `MasterDetailLayout` renders its `detail` subtree twice
 * (mobile drawer + desktop pane). Without this, each instance would bind a
 * window listener and process the same `KeyboardEvent`, moving focus N
 * positions per keystroke.
 *
 * Comparing event identity is enough: tinykeys hands every sibling listener
 * the same event object, so the first listener to fire claims it and the
 * rest short-circuit.
 */
let lastHandledEvent: KeyboardEvent | null = null

/**
 * Per-scope callback registry. Each `useScopeArrowNav` instance registers
 * its `onItemFocus` here so the dedupe-winning instance can fan focus events
 * out to *every* sibling — critical when one logical region is mounted twice
 * (mobile + desktop branches of `MasterDetailLayout`) and each branch holds
 * its own React state that needs to stay in sync.
 */
const onItemFocusRegistry = new Map<
  string,
  Set<(target: HTMLElement) => void>
>()

function registerOnItemFocus(
  scopeId: string,
  callback: (target: HTMLElement) => void,
): () => void {
  let set = onItemFocusRegistry.get(scopeId)
  if (!set) {
    set = new Set()
    onItemFocusRegistry.set(scopeId, set)
  }
  set.add(callback)
  return () => {
    const current = onItemFocusRegistry.get(scopeId)
    if (!current) return
    current.delete(callback)
    if (current.size === 0) onItemFocusRegistry.delete(scopeId)
  }
}

function dispatchItemFocus(scopeId: string, target: HTMLElement) {
  const set = onItemFocusRegistry.get(scopeId)
  if (!set || set.size === 0) return
  for (const callback of set) {
    try {
      callback(target)
    } catch (error) {
      console.error('[useScopeArrowNav] onItemFocus threw:', error)
    }
  }
}

/**
 * Programmatic equivalent of arrow-nav landing on an item: persists the
 * last-focused id and fans out to every consumer registered on the scope.
 * Used by `useScopeSwitcher` so a scope-switch-induced focus runs the same
 * side-effects as a j/k focus would.
 */
export function notifyScopeItemFocus(
  scopeId: string,
  target: HTMLElement,
): void {
  const dataId = target.getAttribute('data-id')
  if (dataId) setLastFocusedItem(scopeId, dataId)
  dispatchItemFocus(scopeId, target)
}

/**
 * Bind J / K, ArrowDown / ArrowUp, Home / End to move keyboard focus through
 * items inside the active focus scope. Items are discovered at fire time via
 * `[data-focus-scope="<id>"] <itemSelector>` and filtered to visible elements.
 *
 * Bindings only fire when the scope is currently active (per
 * `getActiveScopeId()`) and the event target isn't a text input /
 * contentEditable. The handler walks up from `document.activeElement` to find
 * the current item; if none, the first / last item is focused.
 */
export function useScopeArrowNav(options: UseScopeArrowNavOptions): void {
  const scopeIdRef = useRef(options.scopeId)
  scopeIdRef.current = options.scopeId
  const itemSelectorRef = useRef(options.itemSelector)
  itemSelectorRef.current = options.itemSelector
  const onItemFocusRef = useRef(options.onItemFocus)
  onItemFocusRef.current = options.onItemFocus
  const extraRef = useRef(options.extra)
  extraRef.current = options.extra

  // Register this instance's onItemFocus into the per-scope registry so the
  // dedupe-winning listener can dispatch focus events to every sibling.
  useEffect(() => {
    if (!options.onItemFocus) return
    return registerOnItemFocus(options.scopeId, (target) => {
      // Read through the ref so callers can swap the callback without
      // re-registering every render.
      onItemFocusRef.current?.(target)
    })
  }, [options.scopeId, options.onItemFocus])

  useEffect(() => {
    if (options.enabled === false) return
    if (typeof window === 'undefined') return

    const getScopeRoot = (): HTMLElement | null => {
      // Multiple FocusScope instances may share the same id (e.g. desktop
      // aside + mobile drawer). Prefer the one that actually contains
      // `document.activeElement` — this is the branch the user just
      // interacted with, and the only one whose querySelectorAll should be
      // trusted (the hidden branch's items may still pass `checkVisibility`
      // in some browsers, polluting the items array).
      const active = document.activeElement
      if (active instanceof HTMLElement) {
        const owned = active.closest<HTMLElement>(
          `[data-focus-scope="${scopeIdRef.current}"]`,
        )
        if (owned) return owned
      }
      const candidates = Array.from(
        document.querySelectorAll<HTMLElement>(
          `[data-focus-scope="${scopeIdRef.current}"]`,
        ),
      )
      const visible = candidates.find(isItemVisible)
      return visible ?? candidates[0] ?? null
    }

    const getItems = (): HTMLElement[] => {
      const root = getScopeRoot()
      if (!root) return []
      return Array.from(
        root.querySelectorAll<HTMLElement>(itemSelectorRef.current),
      ).filter(isItemVisible)
    }

    const focusAt = (target: HTMLElement) => {
      target.focus({ preventScroll: true })
      target.scrollIntoView({ block: 'nearest' })
      // Persist for cross-scope return: when the user later switches back to
      // this scope via h/l, the switcher reads this id to restore the cursor.
      const dataId = target.getAttribute('data-id')
      if (dataId) setLastFocusedItem(scopeIdRef.current, dataId)
      // Fan out to every registered consumer for this scope (e.g. both
      // mobile + desktop branches of a MasterDetailLayout). Each owns its
      // own React state and needs to stay in sync.
      dispatchItemFocus(scopeIdRef.current, target)
    }

    const move = (direction: 1 | -1) => {
      const items = getItems()
      if (items.length === 0) return
      const active = document.activeElement
      let idx = -1
      if (active instanceof HTMLElement) {
        const itemEl = active.closest<HTMLElement>(itemSelectorRef.current)
        if (itemEl) idx = items.indexOf(itemEl)
      }
      const nextIdx =
        idx === -1
          ? direction === 1
            ? 0
            : items.length - 1
          : (idx + direction + items.length) % items.length
      focusAt(items[nextIdx])
    }

    const jumpToEdge = (edge: 'first' | 'last') => {
      const items = getItems()
      if (items.length === 0) return
      focusAt(items[edge === 'first' ? 0 : items.length - 1])
    }

    const isReachable = (): boolean => {
      // Primary gate: scope is the currently-active one (sticky from prior
      // click). Fallback: document.activeElement happens to be inside the
      // scope's DOM subtree — useful right after a router navigation that
      // restored focus before any user pointerdown was captured.
      if (getActiveScopeId() === scopeIdRef.current) return true
      const active = document.activeElement
      if (active instanceof HTMLElement) {
        return (
          active.closest(`[data-focus-scope="${scopeIdRef.current}"]`) != null
        )
      }
      return false
    }

    const gated =
      (handler: (event: KeyboardEvent) => void) => (event: KeyboardEvent) => {
        // Sibling instance for the same logical region (mobile + desktop
        // branches of MasterDetailLayout) already handled this event.
        if (lastHandledEvent === event) return
        if (!isReachable()) return
        if (isTextInputTarget(event.target)) return
        lastHandledEvent = event
        event.preventDefault()
        handler(event)
      }

    const map: KeybindingsMap = {
      ArrowDown: gated(() => move(1)),
      ArrowUp: gated(() => move(-1)),
      End: gated(() => jumpToEdge('last')),
      Home: gated(() => jumpToEdge('first')),
      j: gated(() => move(1)),
      k: gated(() => move(-1)),
    }
    // Read extra handlers through the ref at fire time so callers can swap
    // closures (e.g. after a re-render) without forcing a rebind.
    const initialExtra = extraRef.current
    if (initialExtra) {
      for (const key of Object.keys(initialExtra)) {
        map[key] = gated((event) => {
          const handler = extraRef.current?.[key]
          if (handler) handler(event)
        })
      }
    }
    return tinykeys(window, map)
  }, [options.enabled])
}
