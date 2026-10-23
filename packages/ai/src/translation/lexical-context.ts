import {
  CodeBlockNode,
  CodeSnippetNode,
  EmbedNode,
  ExcalidrawNode,
  FootnoteNode,
  GalleryNode,
  ImageNode,
  KaTeXBlockNode,
  KaTeXInlineNode,
  LinkCardNode,
  MentionNode,
  MermaidNode,
  VideoNode,
} from '@haklex/rich-headless'

export const NODE_STATE_KEY = '$'
export const BLOCK_ID_STATE_KEY = 'blockId'

export const LEXICAL_CONTEXT_EXCALIDRAW_TYPE = ExcalidrawNode.getType()
export const LEXICAL_CONTEXT_MERMAID_TYPE = MermaidNode.getType()

export const LEXICAL_CONTEXT_SKIP_BLOCKS = new Set([
  'code',
  CodeBlockNode.getType(),
  CodeSnippetNode.getType(),
  'code-highlight',
  ImageNode.getType(),
  VideoNode.getType(),
  GalleryNode.getType(),
  LinkCardNode.getType(),
  KaTeXBlockNode.getType(),
  MermaidNode.getType(),
  EmbedNode.getType(),
  'horizontalrule',
  'component',
])

export const LEXICAL_CONTEXT_SKIP_INLINE = new Set([
  KaTeXInlineNode.getType(),
  MentionNode.getType(),
  FootnoteNode.getType(),
])

export const KNOWN_LEXICAL_STRUCTURAL_PROPS = new Set([
  'children',
  'type',
  'version',
  'direction',
  'format',
  'indent',
  'style',
  'detail',
  'mode',
  'text',
  'tag',
  'listType',
  'start',
  'value',
  'url',
  'rel',
  'target',
  'colSpan',
  'headerState',
  'width',
  NODE_STATE_KEY,
])

export function isNestedLexicalEditorState(
  value: unknown,
): value is { root: { children: any[] } } {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'root' in value &&
    !!value.root &&
    typeof value.root === 'object' &&
    'children' in value.root &&
    Array.isArray(value.root.children)
  )
}

const LEXICAL_CONTEXT_BLOCK_TYPES = new Set([
  'listitem',
  'tablecell',
  'tablerow',
  'details',
  'list',
  'table',
  'root',
])

export function extractExcalidrawTextForContext(node: any): string {
  if (!node.snapshot || typeof node.snapshot !== 'string') return ''
  try {
    const parsed = JSON.parse(node.snapshot)
    if (!parsed.store) return ''
    const texts: string[] = []
    for (const value of Object.values(parsed.store)) {
      const shape = value as any
      if (
        shape?.props?.text &&
        typeof shape.props.text === 'string' &&
        shape.props.text.trim()
      ) {
        texts.push(shape.props.text)
      }
    }
    return texts.join('\n')
  } catch {
    return ''
  }
}

export function extractLexicalContextBlockText(node: any): string {
  if (!node) return ''
  if (node.type === LEXICAL_CONTEXT_EXCALIDRAW_TYPE) {
    return extractExcalidrawTextForContext(node)
  }
  if (LEXICAL_CONTEXT_SKIP_BLOCKS.has(node.type)) return ''
  if (LEXICAL_CONTEXT_SKIP_INLINE.has(node.type)) return ''
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'linebreak') return '\n'

  const parts: string[] = []

  if (Array.isArray(node.children)) {
    const sep = LEXICAL_CONTEXT_BLOCK_TYPES.has(node.type) ? '\n' : ''
    const joined = node.children
      .map(extractLexicalContextBlockText)
      .filter(Boolean)
      .join(sep)
    if (joined) parts.push(joined)
  }

  for (const [propName, propValue] of Object.entries(node)) {
    if (KNOWN_LEXICAL_STRUCTURAL_PROPS.has(propName)) continue
    if (isNestedLexicalEditorState(propValue)) {
      const nested = propValue.root.children
        .map(extractLexicalContextBlockText)
        .filter(Boolean)
      if (nested.length) parts.push(nested.join('\n'))
    }
    if (Array.isArray(propValue)) {
      for (const item of propValue) {
        const states = isNestedLexicalEditorState(item)
          ? [item]
          : item && typeof item === 'object' && !Array.isArray(item)
            ? Object.values(item).filter(isNestedLexicalEditorState)
            : []
        if (
          node.type === 'steps' &&
          typeof item?.title === 'string' &&
          item.title.trim()
        ) {
          parts.push(item.title)
        }
        for (const state of states) {
          const nested = state.root.children
            .map(extractLexicalContextBlockText)
            .filter(Boolean)
          if (nested.length) parts.push(nested.join('\n'))
        }
      }
    }
  }

  return parts.join('\n')
}

export function extractDocumentContext(rootChildren: any[]): string {
  return rootChildren
    .map(extractLexicalContextBlockText)
    .filter(Boolean)
    .join('\n\n')
}
