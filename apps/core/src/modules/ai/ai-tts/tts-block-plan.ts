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
  if (node.type === 'list' && Array.isArray(node.children)) {
    return node.children
      .map((item: any) => collectInlineText(item).trim())
      .filter(Boolean)
      .join(SENTENCE_SEPARATOR)
  }
  if (Array.isArray(node.children)) {
    return node.children.map((child: any) => collectInlineText(child)).join('')
  }
  return ''
}

export function extractSpeakableText(node: any): string {
  return collectInlineText(node).replaceAll(/\s+/g, ' ').trim()
}

const SENTENCE_SPLIT_RE =
  /[^!.?。！？]*[。！？]|[^!.?。！？]*[!.?](?:\s|$)|[^!.?。！？]+$/g

export function splitIntoChunks(text: string, maxChars: number): string[] {
  if (!Number.isFinite(maxChars) || maxChars <= 0) {
    throw new RangeError(
      `splitIntoChunks: maxChars must be a positive finite number, got ${maxChars}`,
    )
  }
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

export interface RootBlockNode {
  id: string | null
  type: string
  node: any
  index: number
}

export function planChunks(
  blocks: RootBlockNode[],
  maxChars: number,
): { chunks: PlannedChunk[]; blocksWithoutId: number[] } {
  const chunks: PlannedChunk[] = []
  const blocksWithoutId: number[] = []

  for (const block of blocks) {
    if (!SPEAKABLE_BLOCK_TYPES.has(block.type)) continue
    const text = extractSpeakableText(block.node)
    if (!text) continue

    if (!block.id) blocksWithoutId.push(block.index)
    const blockId = block.id ?? `idx:${block.index}`

    for (const [chunkIndex, chunkText] of splitIntoChunks(
      text,
      maxChars,
    ).entries()) {
      chunks.push({
        blockId,
        chunkIndex,
        type: block.type,
        text: chunkText,
        fingerprint: computeSpeechFingerprint(block.type, chunkText),
      })
    }
  }

  return { chunks, blocksWithoutId }
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
