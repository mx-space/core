// Lexical translation parser: extract translatable segments from serialized JSON.
// Uses blacklist-based skipping + generalized nested editor detection.

import {
  BLOCK_ID_STATE_KEY,
  NODE_STATE_KEY,
} from '~/constants/lexical.constant'
import {
  isNestedLexicalEditorState,
  KNOWN_LEXICAL_STRUCTURAL_PROPS,
  LEXICAL_CONTEXT_EXCALIDRAW_TYPE,
  LEXICAL_CONTEXT_SKIP_BLOCKS,
  LEXICAL_CONTEXT_SKIP_INLINE,
} from '~/utils/content.util'

const FORMAT_CODE = 16

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

function extractExcalidrawTexts(
  node: any,
  propertySegments: PropertySegment[],
  counter: { t: number; p: number },
  ctx: BlockContext,
): void {
  if (!node.snapshot || typeof node.snapshot !== 'string') return
  let parsed: any
  try {
    parsed = JSON.parse(node.snapshot)
  } catch {
    return
  }
  if (!parsed.store || typeof parsed.store !== 'object') return

  let hasSegments = false
  for (const value of Object.values(parsed.store)) {
    const shape = value as any
    if (
      shape?.props?.text &&
      typeof shape.props.text === 'string' &&
      shape.props.text.trim()
    ) {
      propertySegments.push({
        id: `p_${counter.p++}`,
        text: shape.props.text,
        node: shape.props,
        property: 'text',
        blockId: ctx.blockId,
        rootIndex: ctx.rootIndex,
      })
      hasSegments = true
    }
  }

  if (hasSegments) {
    node.__excalidrawParsed = parsed
  }
}

function walkNode(
  node: any,
  segments: TranslationSegment[],
  propertySegments: PropertySegment[],
  counter: { t: number; p: number },
  ctx: BlockContext,
): void {
  if (!node) return

  // Handle excalidraw: extract text from shapes within snapshot
  if (node.type === LEXICAL_CONTEXT_EXCALIDRAW_TYPE) {
    extractExcalidrawTexts(node, propertySegments, counter, ctx)
    return
  }

  if (LEXICAL_CONTEXT_SKIP_BLOCKS.has(node.type)) return
  if (LEXICAL_CONTEXT_SKIP_INLINE.has(node.type)) return

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
    if (KNOWN_LEXICAL_STRUCTURAL_PROPS.has(propName)) continue

    // Single nested editor state: { root: { children: [...] } }
    if (isNestedLexicalEditorState(propValue)) {
      for (const child of propValue.root.children) {
        walkNode(child, segments, propertySegments, counter, ctx)
      }
      continue
    }

    // Array of nested editor states
    if (Array.isArray(propValue)) {
      for (const item of propValue) {
        if (isNestedLexicalEditorState(item)) {
          for (const child of item.root.children) {
            walkNode(child, segments, propertySegments, counter, ctx)
          }
        }
      }
    }
  }
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

function reStringifyExcalidrawSnapshots(node: any): void {
  if (!node) return
  if (node.__excalidrawParsed) {
    node.snapshot = JSON.stringify(node.__excalidrawParsed)
    delete node.__excalidrawParsed
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      reStringifyExcalidrawSnapshots(child)
    }
  }
  // Scan nested editor states
  for (const [key, val] of Object.entries(node)) {
    if (
      key === 'children' ||
      key === '__excalidrawParsed' ||
      key === 'snapshot'
    )
      continue
    if (
      val &&
      typeof val === 'object' &&
      !Array.isArray(val) &&
      (val as any).root?.children
    ) {
      for (const child of (val as any).root.children) {
        reStringifyExcalidrawSnapshots(child)
      }
    }
    if (Array.isArray(val)) {
      for (const item of val) {
        if (item?.root?.children) {
          for (const child of item.root.children) {
            reStringifyExcalidrawSnapshots(child)
          }
        }
      }
    }
  }
}

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

  // Re-stringify excalidraw snapshots after translation applied
  reStringifyExcalidrawSnapshots(result.editorState.root)

  return JSON.stringify(result.editorState)
}
