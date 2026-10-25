import type { LexicalEditor, NodeKey } from 'lexical'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import type { CaretPoint, RemotePresence } from '../../crdt/collab-presence'
import { type PeersSource, usePeers } from '../../crdt/peers-store'

type Resolve = (point: CaretPoint) => { key: NodeKey; offset: number } | null

interface Box {
  height: number
  left: number
  top: number
  width: number
}

interface DrawnPeer {
  caret: Box
  color: string
  key: string
  name: string
  selection: Box[]
}

const domPoint = (
  editor: LexicalEditor,
  point: { key: NodeKey; offset: number },
): { node: Node; offset: number } | null => {
  const element = editor.getElementByKey(point.key)
  if (!element) return null
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  const text = walker.nextNode() as Text | null
  if (!text) return { node: element, offset: 0 }
  return { node: text, offset: Math.min(point.offset, text.length) }
}

const relative = (rect: DOMRect, origin: DOMRect, frame: HTMLElement): Box => ({
  height: rect.height,
  left: rect.left - origin.left + frame.scrollLeft,
  top: rect.top - origin.top + frame.scrollTop,
  width: rect.width,
})

const measure = (
  editor: LexicalEditor,
  frame: HTMLElement,
  peer: RemotePresence,
  resolve: Resolve,
): DrawnPeer | null => {
  const focusPoint = peer.focus && resolve(peer.focus)
  const focus = focusPoint && domPoint(editor, focusPoint)
  if (!focus) return null
  const origin = frame.getBoundingClientRect()
  const range = document.createRange()
  range.setStart(focus.node, focus.offset)
  range.collapse(true)
  const caretRect =
    range.getClientRects()[0] ??
    (focus.node instanceof Element
      ? focus.node.getBoundingClientRect()
      : range.getBoundingClientRect())

  const selection: Box[] = []
  const anchorPoint = peer.anchor && resolve(peer.anchor)
  const anchor = anchorPoint && domPoint(editor, anchorPoint)
  if (anchor) {
    const span = document.createRange()
    span.setStart(anchor.node, anchor.offset)
    span.setEnd(focus.node, focus.offset)
    if (span.collapsed) {
      span.setStart(focus.node, focus.offset)
      span.setEnd(anchor.node, anchor.offset)
    }
    for (const rect of span.getClientRects()) {
      if (rect.width > 0) selection.push(relative(rect, origin, frame))
    }
  }

  return {
    caret: relative(caretRect, origin, frame),
    color: peer.color,
    key: peer.key,
    name: peer.user.name,
    selection,
  }
}

export function RemoteCarets(props: {
  editor: LexicalEditor | null
  peers: PeersSource
  resolveCaret: Resolve
}) {
  const { editor, resolveCaret } = props
  const peers = usePeers(props.peers)
  const [frame, setFrame] = useState<HTMLElement | null>(null)
  const [drawn, setDrawn] = useState<DrawnPeer[]>([])

  useEffect(() => {
    if (!editor) return
    return editor.registerRootListener((rootElement) => {
      const parent = rootElement?.parentElement ?? null
      if (parent && getComputedStyle(parent).position === 'static') {
        parent.style.position = 'relative'
      }
      setFrame(parent)
    })
  }, [editor])

  useEffect(() => {
    if (!editor || !frame) {
      setDrawn([])
      return
    }
    const update = () =>
      setDrawn(
        peers
          .map((peer) => measure(editor, frame, peer, resolveCaret))
          .filter((peer): peer is DrawnPeer => peer !== null),
      )
    update()
    let raf = 0
    const schedule = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(update)
    }
    const offUpdate = editor.registerUpdateListener(schedule)
    const resize = new ResizeObserver(schedule)
    resize.observe(frame)
    return () => {
      cancelAnimationFrame(raf)
      offUpdate()
      resize.disconnect()
    }
  }, [editor, frame, peers, resolveCaret])

  if (!frame || !drawn.length) return null

  return createPortal(
    <>
      {drawn.map((peer) => (
        <div aria-hidden className="pointer-events-none" key={peer.key}>
          {peer.selection.map((box, index) => (
            <div
              className="absolute z-40 opacity-20"
              key={index}
              style={{ ...box, backgroundColor: peer.color }}
            />
          ))}
          <div
            className="absolute z-50 transition-[left,top] duration-100 ease-out"
            style={{
              height: peer.caret.height || 18,
              left: peer.caret.left,
              top: peer.caret.top,
            }}
          >
            <div
              className="h-full w-0.5 rounded-full"
              style={{ backgroundColor: peer.color }}
            />
            <span
              className="absolute bottom-full left-0 mb-0.5 whitespace-nowrap rounded-sm px-1 py-px text-[10px] font-medium leading-tight text-white"
              data-remote-caret={peer.key}
              style={{ backgroundColor: peer.color }}
            >
              {peer.name}
            </span>
          </div>
        </div>
      ))}
    </>,
    frame,
  )
}
