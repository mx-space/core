import type { LayerTier } from './constants'

import { Z_INDEX_LAYER } from './constants'

let mainTop = 0
let toastTop = 0
let warnedMainOverflow = false

/**
 * Acquire the next z-index for the given tier.
 *
 * `floating` and `modal` share a single monotonic counter so the most recently
 * opened layer always sits on top, regardless of which tier opened first.
 * `toast` is independent so notifications stay above all interactive overlays.
 *
 * Ported from lobe-ui's `base-ui/zIndex/manager.ts`.
 */
export function acquireLayerZIndex(tier: LayerTier): number {
  if (tier === 'toast') {
    toastTop = Math.max(toastTop, Z_INDEX_LAYER.toast) + Z_INDEX_LAYER.step
    return toastTop
  }
  mainTop = Math.max(mainTop, Z_INDEX_LAYER[tier]) + Z_INDEX_LAYER.step
  if (
    process.env.NODE_ENV !== 'production' &&
    !warnedMainOverflow &&
    mainTop >= Z_INDEX_LAYER.toast
  ) {
    warnedMainOverflow = true
    console.warn(
      `[floating-layer] main stack reached toast tier (${mainTop}); unexpected nesting depth`,
    )
  }
  return mainTop
}

/** Test-only: reset counters between specs. */
export function __resetLayerZIndexForTests(): void {
  mainTop = 0
  toastTop = 0
  warnedMainOverflow = false
}

/** Test-only: seed the main counter to exercise overflow paths. */
export function __seedMainTopForTests(value: number): void {
  mainTop = value
}
