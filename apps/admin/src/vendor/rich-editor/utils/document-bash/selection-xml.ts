import type { CapturedSelection } from '@haklex/rich-agent-core'
import { serializeMxLexicalNodesToLitexml } from '@mx-space/editor'
import type { SerializedEditorState, SerializedLexicalNode } from 'lexical'

type BlockNode = SerializedLexicalNode & { $?: { blockId?: string } }

export function buildSelectionXml(
  state: SerializedEditorState,
  selection: CapturedSelection | null,
): string {
  if (!selection) return ''
  const blocks = (state.root.children ?? []) as BlockNode[]

  if (selection.type === 'block') {
    const ids = new Set(selection.blockIds)
    return serialize(blocks.filter((node) => ids.has(node.$?.blockId ?? '')))
  }

  const anchor = blocks.findIndex(
    (n) => n.$?.blockId === selection.anchorBlockId,
  )
  const focus = blocks.findIndex((n) => n.$?.blockId === selection.focusBlockId)
  const spanned =
    anchor === -1 || focus === -1
      ? []
      : blocks.slice(Math.min(anchor, focus), Math.max(anchor, focus) + 1)
  const parts = [`<selected_text>${escapeXml(selection.text)}</selected_text>`]
  if (spanned.length) parts.push(serialize(spanned))
  return parts.join('\n')
}

function serialize(nodes: SerializedLexicalNode[]) {
  return nodes.length
    ? serializeMxLexicalNodesToLitexml(nodes, { compact: false })
    : ''
}

function escapeXml(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}
