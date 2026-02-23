// Lexical translation parser: extract translatable segments from serialized JSON.
// Uses blacklist-based skipping + generalized nested editor detection.

import {
  CodeBlockNode,
  CodeSnippetNode,
  EmbedNode,
  FootnoteNode,
  GalleryNode,
  ImageNode,
  KaTeXBlockNode,
  KaTeXInlineNode,
  LinkCardNode,
  MentionNode,
  MermaidNode,
  TldrawNode,
  VideoNode,
} from '@haklex/rich-headless'

const FORMAT_CODE = 16

const SKIP_BLOCKS = new Set([
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
  TldrawNode.getType(),
  'horizontalrule',
  'component',
])

const SKIP_INLINE = new Set([
  KaTeXInlineNode.getType(),
  MentionNode.getType(),
  FootnoteNode.getType(),
])

const KNOWN_STRUCTURAL_PROPS = new Set([
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
])

export interface TranslationSegment {
  id: string
  text: string
  node: any
  translatable: boolean
}

export interface PropertySegment {
  id: string
  text: string
  node: any
  property: string
  key?: string
}

export interface LexicalTranslationResult {
  segments: TranslationSegment[]
  propertySegments: PropertySegment[]
  editorState: any
}

function walkNode(
  node: any,
  segments: TranslationSegment[],
  propertySegments: PropertySegment[],
  counter: { t: number; p: number },
): void {
  if (!node) return
  if (SKIP_BLOCKS.has(node.type)) return
  if (SKIP_INLINE.has(node.type)) return

  // Special translatable properties
  if (
    node.type === 'details' &&
    typeof node.summary === 'string' &&
    node.summary.trim()
  ) {
    propertySegments.push({
      id: `p_${counter.p++}`,
      text: node.summary,
      node,
      property: 'summary',
    })
  }

  if (
    node.type === 'footnote-section' &&
    node.definitions &&
    typeof node.definitions === 'object'
  ) {
    for (const [key, value] of Object.entries(node.definitions)) {
      if (typeof value === 'string' && (value as string).trim()) {
        propertySegments.push({
          id: `p_${counter.p++}`,
          text: value as string,
          node,
          property: 'definitions',
          key,
        })
      }
    }
  }

  // Text leaf
  if (node.type === 'text') {
    if (node.text?.trim()) {
      segments.push({
        id: `t_${counter.t++}`,
        text: node.text,
        node,
        translatable: !(node.format & FORMAT_CODE),
      })
    }
    return
  }

  // Recurse children first (main content order)
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      walkNode(child, segments, propertySegments, counter)
    }
  }

  // Then scan nested editor states (fixed traversal order)
  scanNestedEditorStates(node, segments, propertySegments, counter)
}

function scanNestedEditorStates(
  node: any,
  segments: TranslationSegment[],
  propertySegments: PropertySegment[],
  counter: { t: number; p: number },
): void {
  for (const [propName, propValue] of Object.entries(node)) {
    if (KNOWN_STRUCTURAL_PROPS.has(propName)) continue

    // Single nested editor state: { root: { children: [...] } }
    if (
      propValue &&
      typeof propValue === 'object' &&
      !Array.isArray(propValue) &&
      (propValue as any).root &&
      Array.isArray((propValue as any).root.children)
    ) {
      for (const child of (propValue as any).root.children) {
        walkNode(child, segments, propertySegments, counter)
      }
      continue
    }

    // Array of nested editor states
    if (Array.isArray(propValue)) {
      for (const item of propValue) {
        if (
          item &&
          typeof item === 'object' &&
          item.root &&
          Array.isArray(item.root.children)
        ) {
          for (const child of item.root.children) {
            walkNode(child, segments, propertySegments, counter)
          }
        }
      }
    }
  }
}

// ── Document context extraction ──

const BLOCK_TYPES = new Set([
  'listitem',
  'tablecell',
  'tablerow',
  'details',
  'list',
  'table',
  'root',
])

function extractBlockText(node: any): string {
  if (!node) return ''
  if (SKIP_BLOCKS.has(node.type)) return ''
  if (SKIP_INLINE.has(node.type)) return ''
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'linebreak') return '\n'

  const parts: string[] = []

  if (Array.isArray(node.children)) {
    const sep = BLOCK_TYPES.has(node.type) ? '\n' : ''
    const joined = node.children.map(extractBlockText).filter(Boolean).join(sep)
    if (joined) parts.push(joined)
  }

  // Nested editor states (same generic scan)
  for (const [propName, propValue] of Object.entries(node)) {
    if (KNOWN_STRUCTURAL_PROPS.has(propName)) continue
    if (
      propValue &&
      typeof propValue === 'object' &&
      !Array.isArray(propValue) &&
      (propValue as any).root &&
      Array.isArray((propValue as any).root.children)
    ) {
      const nested = (propValue as any).root.children
        .map(extractBlockText)
        .filter(Boolean)
      if (nested.length) parts.push(nested.join('\n'))
    }
    if (Array.isArray(propValue)) {
      for (const item of propValue) {
        if (item?.root && Array.isArray(item.root.children)) {
          const nested = item.root.children
            .map(extractBlockText)
            .filter(Boolean)
          if (nested.length) parts.push(nested.join('\n'))
        }
      }
    }
  }

  return parts.join('\n')
}

export function extractDocumentContext(rootChildren: any[]): string {
  return rootChildren.map(extractBlockText).filter(Boolean).join('\n\n')
}

// ── Parser ──

export function parseLexicalForTranslation(
  editorStateJson: string,
): LexicalTranslationResult {
  const editorState = structuredClone(JSON.parse(editorStateJson))
  const rootChildren: any[] = editorState.root?.children ?? []

  const segments: TranslationSegment[] = []
  const propertySegments: PropertySegment[] = []
  const counter = { t: 0, p: 0 }

  for (const child of rootChildren) {
    walkNode(child, segments, propertySegments, counter)
  }

  return { segments, propertySegments, editorState }
}

// ── Restorer ──

export function restoreLexicalTranslation(
  result: LexicalTranslationResult,
  translations: Map<string, string>,
): string {
  for (const seg of result.segments) {
    if (seg.translatable) {
      seg.node.text = translations.get(seg.id) ?? seg.text
    }
  }
  for (const prop of result.propertySegments) {
    const translated = translations.get(prop.id) ?? prop.text
    if (prop.key !== undefined) {
      prop.node[prop.property][prop.key] = translated
    } else {
      prop.node[prop.property] = translated
    }
  }
  return JSON.stringify(result.editorState)
}
