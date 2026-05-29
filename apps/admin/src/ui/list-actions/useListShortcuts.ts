import { useEffect, useRef } from 'react'
import { tinykeys } from 'tinykeys'
import type { KeybindingsMap } from 'tinykeys'
import type { ListAction } from './types'

import { getActiveScopeId } from '~/ui/focus-scope'

export interface UseListShortcutsOptions<T> {
  /** The focus-scope id this shortcut set belongs to. */
  scopeId: string
  /** Function returning the currently-selected targets at fire time. */
  getTargets: () => T[]
  /** Optional extra keybindings outside the action registry (e.g. select-all, clear). */
  extra?: KeybindingsMap
  /** Disable all shortcuts. */
  enabled?: boolean
}

/**
 * Bind keyboard shortcuts for a list of actions, gated on the focus scope
 * being active. Shortcuts fire even when the user has not focused a specific
 * row — only that some interaction has happened inside the scope previously.
 *
 * Actions whose `multi !== true` only fire when exactly one target is
 * selected. Actions whose `available(targets) === false` skip silently.
 */
export function useListShortcuts<T>(
  actions: ReadonlyArray<ListAction<T>>,
  options: UseListShortcutsOptions<T>,
): void {
  // Hold the latest actions, target resolver, and extras in refs so we can
  // rebind only when the shortcut keys actually change — not on every parent
  // render. Handlers always close over the latest values.
  const actionsRef = useRef(actions)
  actionsRef.current = actions
  const getTargetsRef = useRef(options.getTargets)
  getTargetsRef.current = options.getTargets
  const extraRef = useRef(options.extra)
  extraRef.current = options.extra
  const scopeIdRef = useRef(options.scopeId)
  scopeIdRef.current = options.scopeId

  // Stable key bag — used in the effect dependency to detect new bindings.
  const shortcutKeyBag = [
    ...actions.filter((a) => a.shortcut).map((a) => a.shortcut as string),
    ...Object.keys(options.extra ?? {}),
  ]
    .sort()
    .join('|')

  useEffect(() => {
    if (options.enabled === false) return
    if (typeof window === 'undefined') return

    const map: KeybindingsMap = {}

    for (const action of actionsRef.current) {
      if (!action.shortcut) continue
      const key = action.shortcut
      map[key] = (event) => {
        if (getActiveScopeId() !== scopeIdRef.current) return
        const targets = getTargetsRef.current()
        if (targets.length === 0) return
        if (action.multi !== true && targets.length > 1) return
        if (action.available && !action.available(targets)) return
        event.preventDefault()
        void action.run(targets)
      }
    }

    const extra = extraRef.current ?? {}
    for (const [key, handler] of Object.entries(extra)) {
      map[key] = (event) => {
        if (getActiveScopeId() !== scopeIdRef.current) return
        handler(event)
      }
    }

    return tinykeys(window, map)
  }, [shortcutKeyBag, options.enabled])
}
