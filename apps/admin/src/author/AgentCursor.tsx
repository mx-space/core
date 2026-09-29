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
}: {
  cursor: AgentCursorPosition | null
}) {
  const [editor] = useLexicalComposerContext()
  const [rect, setRect] = useState<Rect | null>(null)

  useEffect(() => {
    if (!cursor) {
      setRect(null)
      return
    }
    const update = () => {
      const element = editor.getElementByKey(cursor.key)
      setRect(element ? measure(element, cursor.offset) : null)
    }
    update()
    let frame = 0
    const unregister = editor.registerUpdateListener(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    })
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      cancelAnimationFrame(frame)
      unregister()
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [editor, cursor])

  if (!rect) return null

  return createPortal(
    <div
      aria-hidden
      className="pointer-events-none fixed z-50 transition-[left,top] duration-100 ease-out"
      style={{ left: rect.left, top: rect.top, height: rect.height }}
    >
      <div className="h-full w-0.5 rounded-full bg-violet-500" />
      <span className="absolute bottom-full left-0 mb-0.5 whitespace-nowrap rounded-sm bg-violet-500 px-1 py-px text-[10px] font-medium leading-tight text-white">
        Agent
      </span>
    </div>,
    document.body,
  )
}
