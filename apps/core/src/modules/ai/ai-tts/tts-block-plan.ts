import { md5 } from '~/utils/tool.util'

import type {
  ExistingBlockRow,
  PlannedChunk,
  PlanTtsInput,
  TtsPlan,
} from './ai-tts.types'

export const SPEAKABLE_BLOCK_TYPES: ReadonlySet<string> = new Set([
  'paragraph',
  'heading',
  'quote',
  'rich-quote',
  'list',
])

const SENTENCE_SEPARATOR = '。'

function collectInlineText(node: any): string {
  if (!node || typeof node !== 'object') return ''
  if (node.type === 'text') return String(node.text ?? '')
  if (node.type === 'linebreak') return ' '
  if (Array.isArray(node.children)) {
    return node.children.map((child: any) => collectInlineText(child)).join('')
  }
  return ''
}

export function extractSpeakableText(node: any): string {
  if (!node || typeof node !== 'object') return ''

  const raw =
    node.type === 'list' && Array.isArray(node.children)
      ? node.children
          .map((item: any) => collectInlineText(item).trim())
          .filter(Boolean)
          .join(SENTENCE_SEPARATOR)
      : collectInlineText(node)

  return raw.replaceAll(/\s+/g, ' ').trim()
}

const SENTENCE_SPLIT_RE =
  /[^!.?。！？]*[。！？]|[^!.?。！？]*[!.?](?:\s|$)|[^!.?。！？]+$/g

export function splitIntoChunks(text: string, maxChars: number): string[] {
  if (!text) return []
  if (text.length <= maxChars) return [text]

  const sentences = text.match(SENTENCE_SPLIT_RE) ?? [text]
  const chunks: string[] = []
  let current = ''

  const flush = () => {
    if (current) {
      chunks.push(current)
      current = ''
    }
  }

  for (const sentence of sentences) {
    if (sentence.length > maxChars) {
      flush()
      for (let i = 0; i < sentence.length; i += maxChars) {
        chunks.push(sentence.slice(i, i + maxChars))
      }
      continue
    }
    if (current.length + sentence.length > maxChars) flush()
    current += sentence
  }
  flush()

  return chunks
}

export function computeSpeechFingerprint(
  type: string,
  chunkText: string,
): string {
  return md5(`${type}:${chunkText}`)
}

function rowKey(blockId: string, chunkIndex: number): string {
  return `${blockId}#${chunkIndex}`
}

export function planTts(input: PlanTtsInput): TtsPlan {
  const { chunks, existing, force } = input
  const existingByKey = new Map<string, ExistingBlockRow>(
    existing.map((row) => [rowKey(row.blockId, row.chunkIndex), row]),
  )

  const toGenerate: PlannedChunk[] = []
  const toReuse: TtsPlan['toReuse'] = []
  const consumed = new Set<string>()

  for (const chunk of chunks) {
    const key = rowKey(chunk.blockId, chunk.chunkIndex)
    const row = existingByKey.get(key)
    if (row) consumed.add(row.id)

    if (!force && row && row.fingerprint === chunk.fingerprint) {
      toReuse.push({
        rowId: row.id,
        blockId: chunk.blockId,
        chunkIndex: chunk.chunkIndex,
      })
      continue
    }
    toGenerate.push(chunk)
  }

  const toDelete = existing
    .filter((row) => !consumed.has(row.id))
    .map((row) => ({
      rowId: row.id,
      storageBackend: row.storageBackend,
      storageKey: row.storageKey,
    }))

  const blockOrder: string[] = []
  for (const chunk of chunks) {
    if (blockOrder.at(-1) !== chunk.blockId) blockOrder.push(chunk.blockId)
  }

  return {
    toGenerate,
    toReuse,
    toDelete,
    blockOrder,
    charCount: chunks.reduce((sum, chunk) => sum + chunk.text.length, 0),
  }
}
