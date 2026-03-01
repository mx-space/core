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
  contentFormat?: ContentFormat | string
  content?: string
  summary?: string | null
  tags?: string[]
}

export function isLexical(doc: Pick<ContentDoc, 'contentFormat'>): boolean {
  return doc.contentFormat === ContentFormat.Lexical
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
