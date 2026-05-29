import { useCallback, useEffect, useRef, useState } from 'react'

import { type LayerTier } from './constants'
import { acquireLayerZIndex } from './manager'

export interface LayerZIndexResult<T extends HTMLElement = HTMLElement> {
  ref: (node: T | null) => void
  zIndex: number | undefined
}

/**
 * Subscribe a floating element to the monotonic z-index manager. Each time the
 * target node opens (`data-open` attribute appears, or a `data-closed`
 * transitions away), a fresh z-index is acquired so this layer sits above
 * everything already on screen.
 *
 * Returns a `ref` callback to attach to the floating element (the Base UI
 * Positioner div emits `data-open` / `data-closed`) and the current `zIndex`
 * to apply via inline style.
 *
 * Pass `explicitZIndex` to opt out of the manager and use a fixed value
 * (useful for static overlays / tests).
 *
 * Ported from lobe-ui's `base-ui/zIndex/useLayerZIndex.tsx`.
 */
export function useLayerZIndex<T extends HTMLElement = HTMLElement>(
  tier: LayerTier,
  explicitZIndex?: number,
): LayerZIndexResult<T> {
  const [zIndex, setZIndex] = useState<number | undefined>(undefined)

  const stateRef = useRef<{
    explicit: number | undefined
    node: T | null
    observer: MutationObserver | null
    prevOpen: boolean
    tier: LayerTier
  }>({
    explicit: explicitZIndex,
    node: null,
    observer: null,
    prevOpen: false,
    tier,
  })

  const prevExplicitRef = useRef(explicitZIndex)

  stateRef.current.tier = tier
  stateRef.current.explicit = explicitZIndex

  // When explicitZIndex switches from a fixed value to undefined while the
  // node is already mounted and open, we need to acquire dynamically and
  // start the observer that the ref-callback skipped on initial mount.
  if (
    prevExplicitRef.current !== undefined &&
    explicitZIndex === undefined &&
    stateRef.current.node
  ) {
    const node = stateRef.current.node
    const isOpen = node.hasAttribute('data-open')
    if (isOpen) {
      setZIndex(acquireLayerZIndex(tier))
      stateRef.current.prevOpen = true
    }
    if (!stateRef.current.observer) {
      const handle = () => {
        const open = node.hasAttribute('data-open')
        if (open && !stateRef.current.prevOpen) {
          setZIndex(acquireLayerZIndex(stateRef.current.tier))
        }
        stateRef.current.prevOpen = open
      }
      const observer = new MutationObserver(handle)
      observer.observe(node, {
        attributeFilter: ['data-open', 'data-closed'],
        attributes: true,
      })
      stateRef.current.observer = observer
    }
  }
  prevExplicitRef.current = explicitZIndex

  const ref = useCallback((node: T | null) => {
    if (node === stateRef.current.node) return
    stateRef.current.observer?.disconnect()
    stateRef.current.observer = null
    stateRef.current.node = node
    stateRef.current.prevOpen = false
    if (!node) return
    if (stateRef.current.explicit !== undefined) return
    const handle = () => {
      const isOpen = node.hasAttribute('data-open')
      if (isOpen && !stateRef.current.prevOpen) {
        setZIndex(acquireLayerZIndex(stateRef.current.tier))
      }
      stateRef.current.prevOpen = isOpen
    }
    handle()
    const observer = new MutationObserver(handle)
    observer.observe(node, {
      attributeFilter: ['data-open', 'data-closed'],
      attributes: true,
    })
    stateRef.current.observer = observer
  }, [])

  useEffect(
    () => () => {
      stateRef.current.observer?.disconnect()
    },
    [],
  )

  return { ref, zIndex: stateRef.current.explicit ?? zIndex }
}
