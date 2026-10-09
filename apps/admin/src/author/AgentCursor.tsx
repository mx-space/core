import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import type { NodeKey } from 'lexical'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export interface AgentCursorPosition {
  key: NodeKey
  offset: number
}

interface Rect {
  left: number
  top: number
  height: number
}

const firstTextNode = (element: HTMLElement): Text | null => {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  return walker.nextNode() as Text | null
}

const measure = (element: HTMLElement, offset: number): Rect => {
  const text = firstTextNode(element)
  if (text) {
    const range = document.createRange()
    range.setStart(text, Math.min(offset, text.length))
    range.collapse(true)
    const rect = range.getClientRects()[0] ?? range.getBoundingClientRect()
    if (rect.height > 0) {
      return { left: rect.left, top: rect.top, height: rect.height }
    }
  }
  const box = element.getBoundingClientRect()
  return { left: box.left, top: box.top, height: Math.min(box.height, 24) }
}

export function AgentCursor({
  cursor,
  container,
}: {
  cursor: AgentCursorPosition | null
  container: HTMLElement | null
}) {
  const [editor] = useLexicalComposerContext()
  const [rect, setRect] = useState<Rect | null>(null)

  useEffect(() => {
    if (!cursor || !container) {
      setRect(null)
      return
    }
    const update = () => {
      const element = editor.getElementByKey(cursor.key)
      if (!element) {
        setRect(null)
        return
      }
      const caret = measure(element, cursor.offset)
      const origin = container.getBoundingClientRect()
      setRect({
        left: caret.left - origin.left + container.scrollLeft,
        top: caret.top - origin.top + container.scrollTop,
        height: caret.height,
      })
    }
    update()
    let frame = 0
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }
    const unregister = editor.registerUpdateListener(schedule)
    const resize = new ResizeObserver(schedule)
    resize.observe(container)
    const root = editor.getRootElement()
    if (root) resize.observe(root)
    return () => {
      cancelAnimationFrame(frame)
      unregister()
      resize.disconnect()
    }
  }, [editor, cursor, container])

  if (!rect || !container) return null

  return createPortal(
    <div
      aria-hidden
      className="pointer-events-none absolute z-50 transition-[left,top] duration-100 ease-out"
      style={{ left: rect.left, top: rect.top, height: rect.height }}
    >
      <div className="h-full w-0.5 rounded-full bg-violet-500" />
      <span className="absolute bottom-full left-0 mb-0.5 whitespace-nowrap rounded-sm bg-violet-500 px-1 py-px text-[10px] font-medium leading-tight text-white">
        Agent
      </span>
    </div>,
    container,
  )
}
