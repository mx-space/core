// Lexical translation parser: extract translatable segments from serialized JSON.
// Uses blacklist-based skipping + generalized nested editor detection.

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

import {
  BLOCK_ID_STATE_KEY,
  NODE_STATE_KEY,
} from '~/constants/lexical.constant'

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
  ExcalidrawNode.getType(),
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
  NODE_STATE_KEY,
])

export interface TranslationSegment {
  id: string
  text: string
  node: any
  translatable: boolean
  blockId: string | null
  rootIndex: number
}

export interface PropertySegment {
  id: string
  text: string
  node: any
  property: string
  key?: string
  blockId: string | null
  rootIndex: number
}

export interface LexicalTranslationResult {
  segments: TranslationSegment[]
  propertySegments: PropertySegment[]
  editorState: any
}

interface BlockContext {
  blockId: string | null
  rootIndex: number
}

function walkNode(
  node: any,
  segments: TranslationSegment[],
  propertySegments: PropertySegment[],
  counter: { t: number; p: number },
  ctx: BlockContext,
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
      blockId: ctx.blockId,
      rootIndex: ctx.rootIndex,
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
          blockId: ctx.blockId,
          rootIndex: ctx.rootIndex,
        })
      }
    }
  }

  if (node.type === 'ruby' && typeof node.reading === 'string') {
    propertySegments.push({
      id: `p_${counter.p++}`,
      text: node.reading,
      node,
      property: 'reading',
      blockId: ctx.blockId,
      rootIndex: ctx.rootIndex,
    })
  }

  // Text leaf
  if (node.type === 'text') {
    if (node.text?.trim()) {
      segments.push({
        id: `t_${counter.t++}`,
        text: node.text,
        node,
        translatable: !(node.format & FORMAT_CODE),
        blockId: ctx.blockId,
        rootIndex: ctx.rootIndex,
      })
    }
    return
  }

  // Recurse children first (main content order)
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      walkNode(child, segments, propertySegments, counter, ctx)
    }
  }

  // Then scan nested editor states (fixed traversal order)
  scanNestedEditorStates(node, segments, propertySegments, counter, ctx)
}

function scanNestedEditorStates(
  node: any,
  segments: TranslationSegment[],
  propertySegments: PropertySegment[],
  counter: { t: number; p: number },
  ctx: BlockContext,
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
        walkNode(child, segments, propertySegments, counter, ctx)
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
            walkNode(child, segments, propertySegments, counter, ctx)
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

function readBlockId(node: any): string | null {
  const state = node?.[NODE_STATE_KEY]
  if (!state || typeof state !== 'object' || Array.isArray(state)) return null
  const blockId = state[BLOCK_ID_STATE_KEY]
  return typeof blockId === 'string' && blockId.trim() ? blockId.trim() : null
}

export function parseLexicalForTranslation(
  editorStateJson: string,
): LexicalTranslationResult {
  const editorState = JSON.parse(editorStateJson)
  const rootChildren: any[] = editorState.root?.children ?? []

  const segments: TranslationSegment[] = []
  const propertySegments: PropertySegment[] = []
  const counter = { t: 0, p: 0 }

  for (let i = 0; i < rootChildren.length; i++) {
    const child = rootChildren[i]
    const ctx: BlockContext = {
      blockId: readBlockId(child),
      rootIndex: i,
    }
    walkNode(child, segments, propertySegments, counter, ctx)
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
