import type { Atom, PrimitiveAtom } from 'jotai'

import { jotaiStore } from '~/store/jotai-store'

/**
 * Abstraction for a collapsible + resizable surface where drag-to-collapse
 * must NOT overwrite the persisted "restore" width.
 *
 * Mirrors the lastExpandedPxRef pattern in content-layout.tsx: during a drag
 * the visible width is held in a live override atom; only on pointer-up do we
 * decide whether to commit (persist) or discard (restore the snapshot taken at
 * drag start).
 */
export interface CollapsibleResizeAtoms {
  collapsedAtom: PrimitiveAtom<boolean>
  // The persisted restore width — written only on commit boundaries.
  widthAtom: PrimitiveAtom<number>
  // In-memory override that drives the UI during a drag. null = no override.
  liveWidthAtom: PrimitiveAtom<number | null>
  // Derived read: live override if set, else persisted width.
  effectiveWidthAtom: Atom<number>
}

export interface CollapsibleResizeBounds {
  minPx: number
  maxPx: number
  collapseThresholdPx: number
}

export interface CollapsibleResizeController {
  begin: () => void
  applyClientX: (clientX: number) => void
  end: () => void
}

function clamp(min: number, v: number, max: number) {
  return v < min ? min : v > max ? max : v
}

/**
 * Create an imperative drag controller. The controller writes directly to the
 * jotai store (no React batching) so pointermove stays sub-frame smooth.
 *
 * @param onLiveWidthChange Optional sync side-effect (e.g. setting a CSS var
 *   on <html> for layout that doesn't re-render via React).
 */
export function createCollapsibleResizeController(
  atoms: CollapsibleResizeAtoms,
  bounds: CollapsibleResizeBounds,
  onLiveWidthChange?: (px: number) => void,
): CollapsibleResizeController {
  return {
    begin() {
      // No-op: persisted widthAtom is untouched during drag, so clearing
      // liveWidthAtom on end() naturally restores the pre-drag value.
    },
    applyClientX(clientX: number) {
      if (clientX < bounds.collapseThresholdPx) {
        // Mark collapsed; do NOT touch widthAtom. The live override may still
        // hold its last value — it will be cleared on end().
        jotaiStore.set(atoms.collapsedAtom, true)
        return
      }
      const next = clamp(bounds.minPx, clientX, bounds.maxPx)
      jotaiStore.set(atoms.liveWidthAtom, next)
      jotaiStore.set(atoms.collapsedAtom, false)
      onLiveWidthChange?.(next)
    },
    end() {
      const collapsedNow = jotaiStore.get(atoms.collapsedAtom)
      if (collapsedNow) {
        // Drag ended in a collapsed state: discard the live override so the
        // effective width reverts to the persisted (unchanged) value.
        jotaiStore.set(atoms.liveWidthAtom, null)
      } else {
        // Drag ended expanded: commit the live override into the persisted
        // restore width and clear the override.
        const live = jotaiStore.get(atoms.liveWidthAtom)
        if (live != null) {
          jotaiStore.set(atoms.widthAtom, live)
          jotaiStore.set(atoms.liveWidthAtom, null)
        }
      }
    },
  }
}
