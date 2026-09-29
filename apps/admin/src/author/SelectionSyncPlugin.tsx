import { blockIdState } from '@haklex/rich-editor'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $getSelection,
  $getState,
  $isLineBreakNode,
  $isRangeSelection,
  $isRootNode,
  $isTextNode,
  type LexicalNode,
} from 'lexical'
import { useEffect } from 'react'

const DEBOUNCE_MS = 200

interface SelectedBlock {
  id: string
  text: string
}

const $rootChild = (node: LexicalNode): LexicalNode => {
  let current = node
  for (
    let parent = current.getParent();
    parent && !$isRootNode(parent);
    parent = parent.getParent()
  ) {
    current = parent
  }
  return current
}

const $blockOf = (node: LexicalNode): SelectedBlock => ({
  id: $getState($rootChild(node), blockIdState),
  text: '',
})

const $readSelection = () => {
  const selection = $getSelection()
  if (!$isRangeSelection(selection)) return null
  if (selection.isCollapsed()) {
    return {
      collapsed: true,
      text: '',
      blocks: [$blockOf(selection.anchor.getNode())],
    }
  }
  const [start, end] = selection.isBackward()
    ? [selection.focus, selection.anchor]
    : [selection.anchor, selection.focus]
  const blocks = new Map<string, SelectedBlock & { parent?: string }>()
  for (const node of selection.getNodes()) {
    const key = $rootChild(node).getKey()
    const block: SelectedBlock & { parent?: string } =
      blocks.get(key) ?? $blockOf(node)
    blocks.set(key, block)
    const parent = node.getParent()?.getKey()
    const piece = $isTextNode(node)
      ? node
          .getTextContent()
          .slice(
            node.is(start.getNode()) ? start.offset : 0,
            node.is(end.getNode()) ? end.offset : undefined,
          )
      : $isLineBreakNode(node)
        ? '\n'
        : null
    if (piece === null) continue
    if (block.text && block.parent !== parent) block.text += '\n'
    block.text += piece
    block.parent = parent
  }
  return {
    collapsed: false,
    text: selection.getTextContent(),
    blocks: [...blocks.values()].map(({ id, text }) => ({ id, text })),
  }
}

export function SelectionSyncPlugin() {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let sent = ''
    const send = () => {
      const selection = editor.read($readSelection)
      // Keep the last selection on disk when focus leaves the editor: the
      // human usually selects, then switches to the terminal to ask the agent.
      if (!selection) return
      const body = JSON.stringify(selection)
      if (body === sent) return
      sent = body
      void fetch('/api/selection', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      })
        .then((res) => {
          if (!res.ok) sent = ''
        })
        .catch(() => {
          sent = ''
        })
    }
    const unregister = editor.registerUpdateListener(() => {
      clearTimeout(timer)
      timer = setTimeout(send, DEBOUNCE_MS)
    })
    return () => {
      clearTimeout(timer)
      unregister()
    }
  }, [editor])

  return null
}
