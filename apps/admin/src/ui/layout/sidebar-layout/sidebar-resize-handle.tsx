import type { PointerEvent as ReactPointerEvent } from 'react'
import { useCallback, useEffect, useMemo, useRef } from 'react'

import {
  SIDEBAR_COLLAPSE_THRESHOLD,
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
} from '~/constants/layout'
import { cn } from '~/utils/cn'

import {
  effectiveSidebarWidthAtom,
  sidebarCollapsedAtom,
  sidebarLiveWidthAtom,
  sidebarWidthAtom,
} from './atoms'
import { createCollapsibleResizeController } from './collapsible-resize-controller'

function setSidebarVar(px: number) {
  document.documentElement.style.setProperty('--sidebar-width', `${px}px`)
}

interface Props {
  className?: string
}

export function SidebarResizeHandle({ className }: Props) {
  const draggingRef = useRef(false)
  const pointerIdRef = useRef<number | null>(null)
  const elRef = useRef<HTMLDivElement | null>(null)

  const controller = useMemo(
    () =>
      createCollapsibleResizeController(
        {
          collapsedAtom: sidebarCollapsedAtom,
          widthAtom: sidebarWidthAtom,
          liveWidthAtom: sidebarLiveWidthAtom,
          effectiveWidthAtom: effectiveSidebarWidthAtom,
        },
        {
          minPx: SIDEBAR_WIDTH_MIN,
          maxPx: SIDEBAR_WIDTH_MAX,
          collapseThresholdPx: SIDEBAR_COLLAPSE_THRESHOLD,
        },
        setSidebarVar,
      ),
    [],
  )

  const finishDrag = useCallback(() => {
    if (!draggingRef.current) return
    draggingRef.current = false
    delete document.body.dataset.sidebarResizing
    const el = elRef.current
    const id = pointerIdRef.current
    if (el && id != null) {
      try {
        el.releasePointerCapture(id)
      } catch {
        // ignored — pointer may have already been released
      }
    }
    pointerIdRef.current = null
    controller.end()
  }, [controller])

  // Always run cleanup on unmount; if a drag was in flight, close it out so
  // liveWidthAtom doesn't get stuck.
  useEffect(() => {
    return () => {
      if (draggingRef.current) finishDrag()
    }
  }, [finishDrag])

  useEffect(() => {
    const onBlur = () => finishDrag()
    window.addEventListener('blur', onBlur)
    return () => window.removeEventListener('blur', onBlur)
  }, [finishDrag])

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      e.preventDefault()
      draggingRef.current = true
      pointerIdRef.current = e.pointerId
      document.body.dataset.sidebarResizing = 'true'
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // ignored
      }
      controller.begin()
    },
    [controller],
  )

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return
      controller.applyClientX(e.clientX)
    },
    [controller],
  )

  const onPointerUp = useCallback(
    (_e: ReactPointerEvent<HTMLDivElement>) => {
      finishDrag()
    },
    [finishDrag],
  )

  const onLostCapture = useCallback(() => {
    finishDrag()
  }, [finishDrag])

  return (
    <div
      ref={elRef}
      aria-label="Resize sidebar"
      aria-orientation="vertical"
      className={cn(
        // 1px 细线，贴 aside 右缘作 border 之代
        'absolute inset-y-0 right-0 z-10 w-px cursor-col-resize bg-border transition-colors',
        // 透明 hit zone，左右各扩 3px 便拖拽
        'before:absolute before:inset-y-0 before:-left-[3px] before:-right-[3px] before:content-[""]',
        'hover:bg-border-strong',
        'data-[active=true]:bg-border-strong',
        className,
      )}
      data-active={draggingRef.current ? 'true' : 'false'}
      onLostPointerCapture={onLostCapture}
      onPointerCancel={onPointerUp}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      role="separator"
    />
  )
}
