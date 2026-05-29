import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

const FloatLayerContainerContext = createContext<HTMLElement | null>(null)

/**
 * Reads the FloatLayer portal target.
 *
 * Floating components (ContextMenu, DropdownMenu, Tooltip, etc.) should pass
 * the returned element to Base UI's `Portal container={...}` so popups escape
 * any stacking context an ancestor may have created via `transform`,
 * `filter`, `isolation`, `position`, or `z-index`.
 *
 * Returns `null` until the provider mounts. Consumers should treat `null` as
 * "use default portal target" (Base UI falls back to `document.body`).
 */
export function useFloatLayerContainer(): HTMLElement | null {
  return useContext(FloatLayerContainerContext)
}

/**
 * Mounts a portal-host `<div>` and exposes it via context so descendants
 * Portal their popups into a known top-level DOM node. Place this near the
 * root of the application so the host element sits outside any stacking
 * context created by interior components.
 *
 * Inspired by lobe-ui's `AppElementContext` / `useAppElement` pattern.
 */
export function FloatLayerProvider(props: { children: ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null)
  return (
    <FloatLayerContainerContext.Provider value={el}>
      {props.children}
      <div data-float-layer-host="" ref={setEl} />
    </FloatLayerContainerContext.Provider>
  )
}
