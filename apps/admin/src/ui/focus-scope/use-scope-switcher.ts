import { useEffect } from 'react'
import { tinykeys } from 'tinykeys'

import { isItemVisible, isTextInputTarget } from './dom-utils'
import { getActiveScopeId, getLastFocusedItem, setActiveScope } from './hooks'
import { notifyScopeItemFocus } from './use-scope-arrow-nav'

export interface UseScopeSwitcherOptions {
  /** Disable bindings. */
  enabled?: boolean
}

/**
 * Bind H / L and ArrowLeft / ArrowRight to switch the active FocusScope to
 * its left/right visible sibling. Topology = DOM order of
 * `[data-focus-scope]` elements filtered to visible (per `checkVisibility`),
 * deduped by id (first visible instance wins, matching `getScopeRoot`'s
 * preference rule in `use-scope-arrow-nav`). No wrap at boundaries.
 *
 * After switching, focus is restored to the scope's last-focused item (read
 * from the focus-scope store) when one is recorded and still in the DOM;
 * otherwise the scope's first `[data-scope-item]` descendant; otherwise the
 * scope's container element.
 *
 * Mount ONCE at the shell level — one global binding handles the whole app.
 */
export function useScopeSwitcher(options: UseScopeSwitcherOptions = {}): void {
  useEffect(() => {
    if (options.enabled === false) return
    if (typeof window === 'undefined') return

    const hasSize = (el: HTMLElement): boolean => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    }

    const getOrderedScopes = (): HTMLElement[] => {
      const all = Array.from(
        document.querySelectorAll<HTMLElement>('[data-focus-scope]'),
      )
      const seen = new Set<string>()
      const out: HTMLElement[] = []
      for (const el of all) {
        const id = el.dataset.focusScope
        if (!id) continue
        if (seen.has(id)) continue
        if (!isItemVisible(el)) continue
        // Collapsed sidebar lives behind a 0-width grid column; the element
        // still passes `checkVisibility` because display/visibility are
        // untouched. Filter zero-size scopes so h/l can't land in them.
        if (!hasSize(el)) continue
        seen.add(id)
        out.push(el)
      }
      return out
    }

    const focusInto = (scopeEl: HTMLElement) => {
      const scopeId = scopeEl.dataset.focusScope
      if (!scopeId) return
      const land = (el: HTMLElement) => {
        el.focus({ preventScroll: true })
        el.scrollIntoView({ block: 'nearest' })
        // Run the same side-effects an arrow-nav focus would: persist the
        // last-focused id and dispatch to scope consumers (selection +
        // route navigation in list panes).
        notifyScopeItemFocus(scopeId, el)
      }
      const lastId = getLastFocusedItem(scopeId)
      if (lastId) {
        const escaped =
          typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
            ? CSS.escape(lastId)
            : lastId.replaceAll('"', '\\"')
        const el = scopeEl.querySelector<HTMLElement>(`[data-id="${escaped}"]`)
        if (el && isItemVisible(el)) {
          land(el)
          return
        }
      }
      // Prefer an aria-current item (active sidebar route, detail target row)
      // over the literal first item — otherwise switching into the sidebar
      // would always land on the topmost nav and navigate away from the
      // user's current route.
      const current = Array.from(
        scopeEl.querySelectorAll<HTMLElement>(
          '[data-scope-item][aria-current]',
        ),
      ).find((el) => {
        const v = el.getAttribute('aria-current')
        return v != null && v !== 'false' && isItemVisible(el)
      })
      if (current) {
        land(current)
        return
      }
      const first = scopeEl.querySelector<HTMLElement>('[data-scope-item]')
      if (first && isItemVisible(first)) {
        land(first)
        return
      }
      // Last resort: focus the scope container itself (tabIndex=-1).
      scopeEl.focus({ preventScroll: true })
    }

    const move = (direction: 1 | -1) => {
      const activeId = getActiveScopeId()
      if (!activeId) return
      const scopes = getOrderedScopes()
      const idx = scopes.findIndex((el) => el.dataset.focusScope === activeId)
      if (idx === -1) return
      const nextIdx = idx + direction
      if (nextIdx >= 0 && nextIdx < scopes.length) {
        const target = scopes[nextIdx]
        const targetId = target.dataset.focusScope
        if (!targetId) return
        setActiveScope(targetId)
        focusInto(target)
        return
      }
      // Right boundary: there's no sibling scope to switch to (e.g. list pane
      // with no detail open, or list with no item-row focused yet). Re-fire
      // the current scope's onItemFocus for the focused row, or for the first
      // row if none is focused. For master-detail list panes this opens the
      // detail (mounting the detail scope so a subsequent l can switch into
      // it). Left boundary is a hard stop — there's nothing left of the
      // sidebar.
      if (direction !== 1) return
      const scope = scopes[idx]
      const active = document.activeElement
      if (active instanceof HTMLElement) {
        const item = active.closest<HTMLElement>('[data-scope-item]')
        if (item && scope.contains(item)) {
          notifyScopeItemFocus(activeId, item)
          return
        }
      }
      const first = scope.querySelector<HTMLElement>('[data-scope-item]')
      if (first && isItemVisible(first)) {
        first.focus({ preventScroll: true })
        first.scrollIntoView({ block: 'nearest' })
        notifyScopeItemFocus(activeId, first)
      }
    }

    const gated =
      (handler: (event: KeyboardEvent) => void) => (event: KeyboardEvent) => {
        if (!getActiveScopeId()) return
        if (isTextInputTarget(event.target)) return
        event.preventDefault()
        handler(event)
      }

    return tinykeys(window, {
      ArrowLeft: gated(() => move(-1)),
      ArrowRight: gated(() => move(1)),
      h: gated(() => move(-1)),
      l: gated(() => move(1)),
    })
  }, [options.enabled])
}
