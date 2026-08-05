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
import { ContentFormat } from '~/shared/types/content-format.type'

import { pickFilesFromMarkdown } from './pic.util'
import { md5 } from './tool.util'

interface ContentDoc {
  text: string | null
  title: string
  subtitle?: string | null
  contentFormat?: ContentFormat | string | null
  content?: string | null
  images?: unknown[] | null
  summary?: string | null
  tags?: string[]
  meta?: Record<string, any> | string | null
}

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

const LEXICAL_CONTEXT_BLOCK_TYPES = new Set([
  'listitem',
  'tablecell',
  'tablerow',
  'details',
  'list',
  'table',
  'root',
])

export function isLexical(doc: Pick<ContentDoc, 'contentFormat'>): boolean {
  return doc.contentFormat === ContentFormat.Lexical
}

export function extractTextFromContent(
  doc: Pick<ContentDoc, 'text' | 'contentFormat' | 'content'>,
): string {
  if (!isLexical(doc)) {
    return doc.text || ''
  }

  if (!doc.content) {
    return doc.text || ''
  }

  try {
    const editorState = JSON.parse(doc.content)
    if (!Array.isArray(editorState?.root?.children)) {
      return doc.text || ''
    }

    return normalizeExtractedText(
      extractDocumentContext(editorState.root.children),
    )
  } catch {
    return doc.text || ''
  }
}

export function extractFileUrlsFromContent(
  doc: Pick<
    ContentDoc,
    'text' | 'contentFormat' | 'content' | 'images' | 'meta'
  >,
): string[] {
  const documentMetadataUrls = collectFileUrls([
    doc.images,
    parseMeta(doc.meta),
  ])

  if (!isLexical(doc)) {
    return dedupeFileUrls([
      ...pickFilesFromMarkdown(doc.text ?? ''),
      ...collectFileUrls(doc.text),
      ...documentMetadataUrls,
    ])
  }

  if (!doc.content) {
    return dedupeFileUrls(documentMetadataUrls)
  }

  try {
    const editorState = JSON.parse(doc.content)
    return dedupeFileUrls([
      ...collectFileUrls(editorState),
      ...documentMetadataUrls,
    ])
  } catch {
    return dedupeFileUrls(documentMetadataUrls)
  }
}

/**
 * Backward-compatible name retained for call sites outside the file module.
 * The extraction now covers every uploaded file URL, not only images.
 */
export const extractImagesFromContent = extractFileUrlsFromContent

function parseMeta(meta: ContentDoc['meta']): unknown {
  if (!meta || typeof meta !== 'string') return meta
  return JSON.safeParse(meta)
}

function collectFileUrls(value: unknown): string[] {
  const urls: string[] = []
  const visited = new WeakSet<object>()

  const visit = (current: unknown) => {
    if (typeof current === 'string') {
      urls.push(...extractHttpUrls(current))
      return
    }
    if (!current || typeof current !== 'object') return
    if (visited.has(current)) return
    visited.add(current)

    if (Array.isArray(current)) {
      for (const item of current) visit(item)
      return
    }

    for (const nested of Object.values(current)) visit(nested)
  }

  visit(value)
  return urls
}

function extractHttpUrls(value: string): string[] {
  const trimmed = value.trim()
  if (!trimmed) return []

  if (!/\s/u.test(trimmed)) {
    try {
      const url = new URL(trimmed)
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        return [trimmed]
      }
    } catch {
      // Fall through to extracting URLs embedded in Markdown, JSON, or text.
    }
  }

  return [...trimmed.matchAll(/https?:\/\/[^\s<>"'`\\]+/giu)].map(([url]) =>
    url.replaceAll(/[\]),.;!?]+$/gu, ''),
  )
}

function dedupeFileUrls(urls: string[]): string[] {
  return [...new Set(urls.filter(Boolean))]
}

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
        if (!isNestedLexicalEditorState(item)) continue
        const nested = item.root.children
          .map(extractLexicalContextBlockText)
          .filter(Boolean)
        if (nested.length) parts.push(nested.join('\n'))
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

export function computeContentHash(
  doc: ContentDoc,
  sourceLang: string,
): string {
  const sourceOfTruth = isLexical(doc)
    ? canonicalizeLexicalContentForHash(doc.content ?? undefined)
    : doc.text

  return md5(
    JSON.stringify({
      title: doc.title,
      subtitle: doc.subtitle,
      content: sourceOfTruth,
      summary: doc.summary,
      tags: doc.tags,
      sourceLang,
    }),
  )
}

export function traverseLexicalNodes(
  node: any,
  visitor: (node: any) => void,
): void {
  if (!node) return
  visitor(node)
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      traverseLexicalNodes(child, visitor)
    }
  }
}

function canonicalizeLexicalContentForHash(
  content?: string,
): string | undefined {
  if (!content) return content

  try {
    const editorState = JSON.parse(content)
    return JSON.stringify(normalizeLexicalValueForHash(editorState))
  } catch {
    return content
  }
}

function normalizeLexicalValueForHash(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeLexicalValueForHash(item))
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  const record = value as Record<string, unknown>
  const normalized: Record<string, unknown> = {}
  const keys = Object.keys(record).sort()

  for (const key of keys) {
    const raw = record[key]

    if (
      key === NODE_STATE_KEY &&
      raw &&
      typeof raw === 'object' &&
      !Array.isArray(raw)
    ) {
      const state = raw as Record<string, unknown>
      const stateNormalized: Record<string, unknown> = {}
      const stateKeys = Object.keys(state).sort()

      for (const stateKey of stateKeys) {
        if (stateKey === BLOCK_ID_STATE_KEY) continue
        stateNormalized[stateKey] = normalizeLexicalValueForHash(
          state[stateKey],
        )
      }

      if (Object.keys(stateNormalized).length > 0) {
        normalized[key] = stateNormalized
      }
      continue
    }

    normalized[key] = normalizeLexicalValueForHash(raw)
  }

  return normalized
}

function normalizeExtractedText(text: string) {
  return text.replaceAll(/\s+/g, ' ').trim()
}
