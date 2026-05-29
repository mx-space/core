/**
 * Portal layer stacking.
 *
 * base-ui 之 Portal 不主动设 z-index，故须由消费者管控。
 * 设两层语义：
 *
 * 1. Tier offset：drawer < dialog < popover < toast。同 depth 内之相对次序。
 * 2. Depth context：每开一浮层，其 Portal 之子树位 depth+1。嵌套之浮层读 context 即知自身 depth，z-index 累加，故自然浮于祖层之上。
 *
 * 用法：浮层组件渲 Portal 内容时以 `<PortalLayerScope depth={depth}>` 包裹，并以 `useFloatingZ(tier)` 取 z 与 depth。
 */
import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'

export type FloatingTier = 'drawer' | 'dialog' | 'popover' | 'toast'

const TIER_OFFSET: Record<FloatingTier, number> = {
  drawer: 0,
  dialog: 2,
  popover: 4,
  toast: 6,
}

const BASE_Z = 1000
const DEPTH_STEP = 100

interface PortalLayerState {
  depth: number
}

const PortalLayerContext = createContext<PortalLayerState>({ depth: 0 })

export interface FloatingZ {
  /** z-index applied to the popup / popup-anchor element. */
  z: number
  /** Depth to pass to `<PortalLayerScope>` so children stack above this layer. */
  depth: number
}

/**
 * Reads the parent depth from context and computes this layer's z-index for the given tier.
 * The layer's depth is parent.depth + 1; descendants rendered inside the popup should be wrapped
 * with `<PortalLayerScope depth={depth}>` so their own floats stack above.
 */
export function useFloatingZ(tier: FloatingTier): FloatingZ {
  const parent = useContext(PortalLayerContext)
  const depth = parent.depth + 1
  const z = BASE_Z + depth * DEPTH_STEP + TIER_OFFSET[tier]
  return { z, depth }
}

/** Wraps Portal content to propagate the current portal depth to descendants. */
export function PortalLayerScope(props: {
  children: ReactNode
  depth: number
}) {
  const value = useMemo(() => ({ depth: props.depth }), [props.depth])
  return (
    <PortalLayerContext.Provider value={value}>
      {props.children}
    </PortalLayerContext.Provider>
  )
}
