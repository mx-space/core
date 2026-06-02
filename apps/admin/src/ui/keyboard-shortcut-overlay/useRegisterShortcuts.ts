import { useEffect, useRef } from 'react'

import type { ShortcutItem } from './KeyboardShortcutsProvider'
import { useKeyboardShortcutsContext } from './KeyboardShortcutsProvider'

/**
 * Register a flat list of shortcut items with the nearest
 * `KeyboardShortcutsProvider`. The registration lives for the lifetime of the
 * calling component — on unmount the items disappear from the `?` overlay.
 *
 * The items array is captured by reference; pass a memoized array if it is
 * built inside a render that re-runs frequently.
 */
export function useRegisterShortcuts(items: ReadonlyArray<ShortcutItem>): void {
  const ctx = useKeyboardShortcutsContext()
  const register = ctx.register
  const itemsRef = useRef(items)
  itemsRef.current = items
  useEffect(() => {
    return register(itemsRef.current)
    // Depend only on `register` (stable per provider) and the `items`
    // reference. Reading `ctx` directly would re-fire the effect whenever the
    // provider's context value changes (e.g. on every other registration),
    // causing an unregister/register cascade.
  }, [register, items])
}
