import * as React from 'react'
import { useEffect, useRef, useState } from 'react'

import { cn } from '~/lib/cn'

export interface FloatingResizeHandlesProps {
  width: number
  height: number
  minWidth?: number
  maxWidth?: number
  minHeight?: number
  maxHeight?: number
  onWidthChange?: (width: number) => void
  onHeightChange?: (height: number) => void
  onCommit?: (size: { width: number; height: number }) => void
  /** Gap from viewport edges (matches panel offset). Default: 16 */
  offset?: number
}

/**
 * Floating panel resize handles for width (left edge), height (top edge), and the top-left corner.
 * Internally manages drag logic and emits continuous updates and final commit.
 */
export function FloatingResizeHandles(props: FloatingResizeHandlesProps) {
  const {
    width,
    height,
    minWidth = 280,
    maxWidth = 800,
    minHeight = 300,
    maxHeight = 800,
    onWidthChange,
    onHeightChange,
    onCommit,
    offset = 16,
  } = props

  const styleElementRef = useRef<HTMLStyleElement | null>(null)
  const [isCornerDragging, setIsCornerDragging] = useState(false)
  const [cornerDraftWidth, setCornerDraftWidth] = useState<number | null>(null)
  const [cornerDraftHeight, setCornerDraftHeight] = useState<number | null>(
    null,
  )
  const cornerDraftWidthRef = useRef<number | null>(null)
  const cornerDraftHeightRef = useRef<number | null>(null)
  const [isWidthDragging, setIsWidthDragging] = useState(false)
  const [isHeightDragging, setIsHeightDragging] = useState(false)
  const [widthDraft, setWidthDraft] = useState<number | null>(null)
  const [heightDraft, setHeightDraft] = useState<number | null>(null)
  const widthDraftRef = useRef<number | null>(null)
  const heightDraftRef = useRef<number | null>(null)

  const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max)

  const ensureCursorStyle = (cursor: string) => {
    if (styleElementRef.current) return
    const $css = document.createElement('style')
    $css.innerHTML = `* { cursor: ${cursor} !important; user-select: none !important; }`
    document.head.append($css)
    styleElementRef.current = $css
  }

  const cleanupCursorStyle = () => {
    styleElementRef.current?.remove()
    styleElementRef.current = null
  }

  // Horizontal resizer (left edge)
  const widthOnMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isCornerDragging) return
    event.preventDefault()
    event.stopPropagation()
    ensureCursorStyle('ew-resize')
    setIsWidthDragging(true)
    const startX = event.clientX
    const startWidth = width
    setWidthDraft(startWidth)
    const onMove = (e: MouseEvent) => {
      const deltaX = startX - e.clientX
      const nextWidth = clamp(startWidth + deltaX, minWidth, maxWidth)
      setWidthDraft(nextWidth)
      widthDraftRef.current = nextWidth
      onWidthChange?.(nextWidth)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      cleanupCursorStyle()
      setIsWidthDragging(false)
      const finalWidth = widthDraftRef.current ?? widthDraft ?? startWidth
      onCommit?.({ width: finalWidth, height: displayHeight })
      window.dispatchEvent(new Event('resize'))
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // Vertical resizer (top edge)
  const heightOnMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isCornerDragging) return
    event.preventDefault()
    event.stopPropagation()
    ensureCursorStyle('ns-resize')
    setIsHeightDragging(true)
    const startY = event.clientY
    const startHeight = height
    setHeightDraft(startHeight)
    const onMove = (e: MouseEvent) => {
      const deltaY = startY - e.clientY
      const nextHeight = clamp(startHeight + deltaY, minHeight, maxHeight)
      setHeightDraft(nextHeight)
      heightDraftRef.current = nextHeight
      onHeightChange?.(nextHeight)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      cleanupCursorStyle()
      setIsHeightDragging(false)
      const finalHeight = heightDraftRef.current ?? heightDraft ?? startHeight
      onCommit?.({ width: displayWidth, height: finalHeight })
      window.dispatchEvent(new Event('resize'))
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // Continuous updates outward - only when the corresponding axis is dragging
  useEffect(() => {
    if (isWidthDragging && !isCornerDragging)
      onWidthChange?.(widthDraft ?? width)
  }, [widthDraft, width, isWidthDragging, isCornerDragging, onWidthChange])
  useEffect(() => {
    if (isHeightDragging && !isCornerDragging)
      onHeightChange?.(heightDraft ?? height)
  }, [heightDraft, height, isHeightDragging, isCornerDragging, onHeightChange])

  // Effective positions used for handle placement
  const displayWidth = isCornerDragging
    ? (cornerDraftWidth ?? width)
    : isWidthDragging
      ? (widthDraft ?? width)
      : width
  const displayHeight = isCornerDragging
    ? (cornerDraftHeight ?? height)
    : isHeightDragging
      ? (heightDraft ?? height)
      : height

  // Corner dragging placement
  const bottom = `${displayHeight + offset}px`
  const right = `${displayWidth + offset}px`

  return (
    <>
      {/* Width handle (left edge of floating panel) */}
      <div
        className={cn('fixed z-[60] top-auto left-auto h-0 w-0')}
        style={{
          bottom: `${offset}px`,
          right: `${displayWidth + offset}px`,
          height: `${displayHeight}px`,
        }}
        onMouseDown={widthOnMouseDown}
      >
        <div
          className={cn(
            'absolute inset-y-0 left-0 w-[6px] -translate-x-1/2 cursor-ew-resize',
            'bg-transparent hover:bg-accent/50 active:bg-accent rounded-sm',
            isWidthDragging && 'bg-accent',
          )}
        />
      </div>

      {/* Height handle (top edge of floating panel) */}
      <div
        className={cn('fixed z-[60] top-auto left-auto w-0 h-0')}
        style={{
          bottom: `${displayHeight + offset}px`,
          right: `${offset}px`,
          width: `${displayWidth}px`,
        }}
        onMouseDown={heightOnMouseDown}
      >
        <div
          className={cn(
            'absolute inset-x-0 top-0 h-[6px] -translate-y-1/2 cursor-ns-resize',
            'bg-transparent hover:bg-accent/50 active:bg-accent rounded-sm',
            isHeightDragging && 'bg-accent',
          )}
        />
      </div>

      {/* Corner handle (top-left corner of floating panel) */}
      <div
        className="fixed z-[60]"
        style={{ bottom, right }}
        onMouseDown={(event) => {
          event.preventDefault()
          event.stopPropagation()

          const startX = event.clientX
          const startY = event.clientY
          const startWidth = displayWidth
          const startHeight = displayHeight
          setIsCornerDragging(true)
          setCornerDraftWidth(startWidth)
          setCornerDraftHeight(startHeight)
          cornerDraftWidthRef.current = startWidth
          cornerDraftHeightRef.current = startHeight

          const $css = document.createElement('style')
          $css.innerHTML = `* { cursor: nw-resize !important; user-select: none !important; }`
          document.head.append($css)

          const onMove = (e: MouseEvent) => {
            const deltaX = startX - e.clientX
            const deltaY = startY - e.clientY
            const nextWidth = clamp(startWidth + deltaX, minWidth, maxWidth)
            const nextHeight = clamp(startHeight + deltaY, minHeight, maxHeight)
            setCornerDraftWidth(nextWidth)
            setCornerDraftHeight(nextHeight)
            cornerDraftWidthRef.current = nextWidth
            cornerDraftHeightRef.current = nextHeight
            onWidthChange?.(nextWidth)
            onHeightChange?.(nextHeight)
          }

          const onUp = () => {
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
            $css.remove()
            onCommit?.({
              width:
                cornerDraftWidthRef.current ?? cornerDraftWidth ?? startWidth,
              height:
                cornerDraftHeightRef.current ??
                cornerDraftHeight ??
                startHeight,
            })
            setIsCornerDragging(false)
            window.dispatchEvent(new Event('resize'))
          }

          window.addEventListener('mousemove', onMove)
          window.addEventListener('mouseup', onUp)
        }}
      >
        <div className="translate-x-1/2 translate-y-1/2 w-3 h-3 cursor-nw-resize bg-transparent hover:bg-accent/50 active:bg-accent rounded" />
      </div>
    </>
  )
}
