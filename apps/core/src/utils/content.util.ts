import {
  BLOCK_ID_STATE_KEY,
  NODE_STATE_KEY,
} from '~/constants/lexical.constant'
import { ContentFormat } from '~/shared/types/content-format.type'

import { pickImagesFromMarkdown } from './pic.util'
import { md5 } from './tool.util'

interface ContentDoc {
  text: string
  title: string
  subtitle?: string | null
  contentFormat?: ContentFormat | string
  content?: string
  summary?: string | null
  tags?: string[]
}

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
    if (!editorState?.root) {
      return doc.text || ''
    }

    return normalizeExtractedText(extractLexicalNodeText(editorState.root))
  } catch {
    return doc.text || ''
  }
}

export function extractImagesFromContent(
  doc: Pick<ContentDoc, 'text' | 'contentFormat' | 'content'>,
): string[] {
  if (!isLexical(doc)) {
    return pickImagesFromMarkdown(doc.text)
  }

  if (!doc.content) return []

  try {
    const editorState = JSON.parse(doc.content)
    const images: string[] = []
    traverseLexicalNodes(editorState.root, (node) => {
      if (node.type === 'image' && node.src) {
        images.push(node.src)
      } else if (node.type === 'gallery' && Array.isArray(node.images)) {
        for (const img of node.images) {
          if (img?.src) images.push(img.src)
        }
      } else if (node.type === 'link-card' && node.image) {
        images.push(node.image)
      }
    })
    return images
  } catch {
    return []
  }
}

export function computeContentHash(
  doc: ContentDoc,
  sourceLang: string,
): string {
  const sourceOfTruth = isLexical(doc)
    ? canonicalizeLexicalContentForHash(doc.content)
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

export function getTranslationPayload(
  doc: Pick<ContentDoc, 'title' | 'text' | 'contentFormat' | 'content'>,
): { format: string; title: string; text?: string; content?: string } {
  if (isLexical(doc)) {
    return { format: 'lexical', title: doc.title, content: doc.content }
  }
  return { format: 'markdown', title: doc.title, text: doc.text }
}

export function applyContentPreference<
  T extends { text?: string; contentFormat?: string; content?: string },
>(doc: T, prefer?: string): T {
  if (
    prefer === 'lexical' &&
    doc.contentFormat === ContentFormat.Lexical &&
    doc.content
  ) {
    const { text, ...rest } = doc
    return rest as T
  }
  return doc
}

function traverseLexicalNodes(node: any, visitor: (node: any) => void): void {
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

const KNOWN_TEXT_STRUCTURAL_PROPS = new Set([
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

const IGNORED_TEXT_METADATA_KEYS = new Set([
  'src',
  'url',
  'id',
  'source',
  'favicon',
  'image',
  'poster',
  'thumbhash',
  'accent',
  'layout',
  'platform',
  'language',
  'identifier',
  'bannerType',
  'alertType',
  'cols',
  'gap',
  'open',
  'width',
  'height',
])

function extractLexicalNodeText(node: any): string {
  if (!node) return ''

  if (node.type === 'text') {
    return String(node.text || '')
  }

  if (typeof node.text === 'string' && node.text.trim()) {
    return node.text
  }

  if (node.type === 'linebreak') {
    return '\n'
  }

  if (typeof node.code === 'string') {
    return node.code
  }

  if (typeof node.snapshot === 'string') {
    return node.snapshot
  }

  const segments: string[] = []

  if (Array.isArray(node.children)) {
    const childText = node.children
      .map((child: any) => extractLexicalNodeText(child))
      .join('')
    if (childText) {
      segments.push(childText)
    }
  }

  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (KNOWN_TEXT_STRUCTURAL_PROPS.has(key)) continue

    const extracted = extractTextFragmentsFromUnknown(value, key)
    if (extracted.length) {
      segments.push(extracted.join('\n'))
    }
  }

  return segments.join('\n')
}

function extractTextFragmentsFromUnknown(
  value: unknown,
  key?: string,
): string[] {
  if (
    value == null ||
    typeof value === 'boolean' ||
    typeof value === 'number'
  ) {
    return []
  }

  if (typeof value === 'string') {
    if (!value.trim()) {
      return []
    }
    if (key && IGNORED_TEXT_METADATA_KEYS.has(key)) {
      return []
    }
    return [value]
  }

  if (isNestedEditorState(value)) {
    const nested = value.root.children
      .map((child: any) => extractLexicalNodeText(child))
      .join('\n')
    return nested ? [nested] : []
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => extractTextFragmentsFromUnknown(item, key))
  }

  if (typeof value !== 'object') {
    return []
  }

  return Object.entries(value as Record<string, unknown>).flatMap(
    ([entryKey, entryValue]) =>
      extractTextFragmentsFromUnknown(entryValue, entryKey),
  )
}

function isNestedEditorState(
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

function normalizeExtractedText(text: string) {
  return text.replaceAll(/\s+/g, ' ').trim()
}
