/**
 * z-index tiers for the floating layer manager.
 *
 * - `floating` / `modal` share a monotonic counter (`mainTop`) — later opens always win
 *   regardless of tier. This matches the user expectation that an opened menu can sit
 *   above a modal that opened it, and submenus naturally stack above their parents.
 * - `toast` has its own independent counter so notifications stay above everything.
 *
 * Ported from lobe-ui's `base-ui/zIndex/constants.ts`.
 */
export const Z_INDEX_LAYER = {
  floating: 1100,
  modal: 1200,
  step: 10,
  toast: 100_000,
} as const

export type LayerTier = 'floating' | 'modal' | 'toast'
