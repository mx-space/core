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
