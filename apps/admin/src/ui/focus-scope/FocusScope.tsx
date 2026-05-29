import { useEffect, useId, useRef } from 'react'
import type { HTMLAttributes, Ref } from 'react'

import { cn } from '~/utils/cn'

import {
  registerFocusScope,
  setActiveScope,
  useFocusScopeActive,
} from './hooks'

export interface FocusScopeProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'children'
> {
  /** Stable id for the scope. If omitted, a random id is generated. */
  id?: string
  /** Forwarded ref to the underlying container element. */
  containerRef?: Ref<HTMLDivElement>
  /**
   * Render a visible dev-time outline around the active scope to make
   * debugging easier. Defaults to `true` in development, `false` otherwise.
   */
  debugOutline?: boolean
  children: React.ReactNode
}

const DEV = import.meta.env.DEV

/**
 * Marks a DOM subtree as a focus scope. A scope becomes active when the user
 * interacts with anything inside it (pointerdown / focusin); other consumers
 * (`useListShortcuts`, command palettes, etc.) can read the active scope to
 * gate behavior. The scope stays sticky — clicking outside any registered
 * scope does NOT clear it. Use `setActiveScope(null)` (e.g. on Escape) when
 * an explicit reset is needed.
 *
 * Renders a `<div tabIndex={-1} data-focus-scope={id}>` — `data-focus-scope`
 * is what the global listeners walk up to. When the scope is active the div
 * gets `data-scope-active=""`, and in development a subtle ring outline is
 * drawn so the currently-listening scope is visible.
 */
export function FocusScope({
  id,
  children,
  containerRef,
  debugOutline,
  className,
  ...rest
}: FocusScopeProps) {
  const generatedId = useId()
  const scopeId = id ?? generatedId
  const ref = useRef<HTMLDivElement | null>(null)
  const isActive = useFocusScopeActive(scopeId)
  const showOutline = debugOutline ?? DEV

  useEffect(() => registerFocusScope(scopeId), [scopeId])

  // DEV: log scope transitions so it's obvious which scope picked up the
  // last interaction. Cheap; only fires on activation.
  useEffect(() => {
    if (!DEV) return
    if (!isActive) return
    // eslint-disable-next-line no-console
    console.info('[FocusScope] active →', scopeId, ref.current)
  }, [scopeId, isActive])

  const setRef = (node: HTMLDivElement | null) => {
    ref.current = node
    if (typeof containerRef === 'function') containerRef(node)
    else if (containerRef) {
      ;(containerRef as React.RefObject<HTMLDivElement | null>).current = node
    }
  }

  return (
    <div
      data-focus-scope={scopeId}
      data-scope-active={isActive ? '' : undefined}
      ref={setRef}
      tabIndex={-1}
      {...rest}
      className={cn(
        'relative',
        // Dev-only debug ring around the active scope. Uses `outline` so it
        // never affects layout. `-outline-offset-2` pulls the ring inside
        // the element so it doesn't bleed past adjacent surfaces.
        showOutline &&
          'data-[scope-active]:outline-dashed data-[scope-active]:outline-2 data-[scope-active]:-outline-offset-2 data-[scope-active]:outline-blue-400/60',
        className,
      )}
      onKeyDown={(event) => {
        rest.onKeyDown?.(event)
        if (event.defaultPrevented) return
        // Pressing Escape while focus is inside the scope deactivates it.
        if (event.key === 'Escape') setActiveScope(null)
      }}
    >
      {children}
    </div>
  )
}
