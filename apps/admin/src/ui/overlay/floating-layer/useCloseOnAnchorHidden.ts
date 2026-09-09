import { useCallback, useEffect, useRef } from 'react'

/**
 * Base UI keeps a popup mounted after its anchor is removed or hidden, and the
 * positioner then falls back to the viewport origin (0,0) while focus escapes
 * to `<body>`. Attach the returned ref to the Positioner element so the popup
 * closes as soon as `data-anchor-hidden` appears.
 */
export function useCloseOnAnchorHidden<T extends HTMLElement = HTMLElement>(
  close: () => void,
): (node: T | null) => void {
  const closeRef = useRef(close)
  closeRef.current = close
  const observerRef = useRef<MutationObserver | null>(null)

  const ref = useCallback((node: T | null) => {
    observerRef.current?.disconnect()
    observerRef.current = null
    if (!node) return
    const handle = () => {
      if (
        node.hasAttribute('data-open') &&
        node.hasAttribute('data-anchor-hidden')
      ) {
        closeRef.current()
      }
    }
    handle()
    const observer = new MutationObserver(handle)
    observer.observe(node, {
      attributeFilter: ['data-anchor-hidden', 'data-open'],
      attributes: true,
    })
    observerRef.current = observer
  }, [])

  useEffect(() => () => observerRef.current?.disconnect(), [])

  return ref
}
