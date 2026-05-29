import { useEffect, useRef, useState } from 'react'
import type { EditorView } from '@codemirror/view'

export interface SelectionPosition {
  x: number
  y: number
  above: boolean
}

const findScrollableParent = (el: HTMLElement | null): HTMLElement | null => {
  while (el) {
    const style = getComputedStyle(el)
    const overflowY = style.overflowY
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      el.scrollHeight > el.clientHeight
    ) {
      return el
    }
    el = el.parentElement
  }
  return null
}

export interface UseSelectionPositionResult {
  position: SelectionPosition | null
  hasSelection: boolean
  selectionText: string
  clearSelection: () => void
  updatePosition: () => void
}

export function useSelectionPosition(
  editorView: EditorView | undefined,
): UseSelectionPositionResult {
  const [position, setPosition] = useState<SelectionPosition | null>(null)
  const [hasSelection, setHasSelection] = useState(false)
  const [selectionText, setSelectionText] = useState('')
  const scrollerRef = useRef<HTMLElement | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updatePosition = () => {
    const view = editorView
    if (!view) {
      setHasSelection(false)
      setPosition(null)
      setSelectionText('')
      return
    }

    const { from, to } = view.state.selection.main

    if (from === to) {
      setHasSelection(false)
      setPosition(null)
      setSelectionText('')
      return
    }

    setSelectionText(view.state.sliceDoc(from, to))
    setHasSelection(true)

    const fromCoords = view.coordsAtPos(from)
    const toCoords = view.coordsAtPos(to)

    if (!fromCoords || !toCoords) {
      setPosition(null)
      return
    }

    const scroller = scrollerRef.current
    if (scroller) {
      const scrollerRect = scroller.getBoundingClientRect()
      const selectionTop = Math.min(fromCoords.top, toCoords.top)
      const selectionBottom = Math.max(fromCoords.bottom, toCoords.bottom)

      if (
        selectionBottom < scrollerRect.top ||
        selectionTop > scrollerRect.bottom
      ) {
        setPosition(null)
        return
      }
    }

    const selectionCenterX = (fromCoords.left + toCoords.right) / 2
    const selectionTop = Math.min(fromCoords.top, toCoords.top)
    const selectionBottom = Math.max(fromCoords.bottom, toCoords.bottom)

    const viewportTop = 120
    const above = selectionTop > viewportTop

    setPosition({
      x: selectionCenterX,
      y: above ? selectionTop : selectionBottom,
      above,
    })
  }

  useEffect(() => {
    const view = editorView
    if (!view) {
      setHasSelection(false)
      setPosition(null)
      setSelectionText('')
      return
    }

    const scroller = findScrollableParent(view.dom) ?? view.scrollDOM
    scrollerRef.current = scroller

    const debouncedUpdate = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(updatePosition, 50)
    }

    const handleMouseUp = () => debouncedUpdate()
    const handleKeyUp = (e: KeyboardEvent) => {
      if (
        e.key === 'Shift' ||
        e.key.startsWith('Arrow') ||
        e.ctrlKey ||
        e.metaKey
      ) {
        debouncedUpdate()
      }
    }
    const handleScroll = () => {
      updatePosition()
    }

    view.dom.addEventListener('mouseup', handleMouseUp)
    view.dom.addEventListener('keyup', handleKeyUp)
    scroller.addEventListener('scroll', handleScroll, { passive: true })

    updatePosition()

    return () => {
      view.dom.removeEventListener('mouseup', handleMouseUp)
      view.dom.removeEventListener('keyup', handleKeyUp)
      scroller.removeEventListener('scroll', handleScroll)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorView])

  const clearSelection = () => {
    setHasSelection(false)
    setPosition(null)
    setSelectionText('')
  }

  return {
    position,
    hasSelection,
    selectionText,
    clearSelection,
    updatePosition,
  }
}
