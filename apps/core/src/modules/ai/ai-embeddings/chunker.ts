import { createHash } from 'node:crypto'

import type { ChunkSpec } from './ai-embeddings.types'

export interface ChunkOptions {
  maxTokens: number
  overlapTokens: number
}

const FENCED_CODE_RE = /```.*?```/gs
const PARAGRAPH_SPLIT_RE = /\n{2,}/
const SENTENCE_SPLIT_RE = /(?<=[!.?。！？])\s+/

const CJK_RE =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu
const ASCII_RE = /[\x20-\x7E]/g

function estimateTokens(text: string): number {
  if (!text) return 0
  const cjk = (text.match(CJK_RE) || []).length
  const ascii = (text.match(ASCII_RE) || []).length
  const total = text.length
  if (cjk === 0 && ascii === 0) return Math.ceil(total / 4)
  const cjkTokens = cjk / 3
  const asciiTokens = ascii / 4
  const otherTokens = Math.max(0, total - cjk - ascii) / 4
  return Math.ceil(cjkTokens + asciiTokens + otherTokens)
}

function sliceByTokenBudget(text: string, maxTokens: number): string[] {
  const out: string[] = []
  if (!text) return out
  const cjk = (text.match(CJK_RE) || []).length
  const ascii = (text.match(ASCII_RE) || []).length
  const charsPerToken = cjk >= ascii ? 3 : 4
  const window = Math.max(1, maxTokens * charsPerToken)
  for (let i = 0; i < text.length; i += window) {
    out.push(text.slice(i, i + window))
  }
  return out
}

function splitOversized(paragraph: string, maxTokens: number): string[] {
  if (estimateTokens(paragraph) <= maxTokens) return [paragraph]
  const sentences = paragraph.split(SENTENCE_SPLIT_RE).filter(Boolean)
  const result: string[] = []
  for (const sentence of sentences) {
    if (estimateTokens(sentence) <= maxTokens) {
      result.push(sentence)
    } else {
      result.push(...sliceByTokenBudget(sentence, maxTokens))
    }
  }
  return result
}

function tailTokens(text: string, overlapTokens: number): string {
  if (overlapTokens <= 0 || !text) return ''
  const cjk = (text.match(CJK_RE) || []).length
  const ascii = (text.match(ASCII_RE) || []).length
  const charsPerToken = cjk >= ascii ? 3 : 4
  const tailChars = Math.min(text.length, overlapTokens * charsPerToken)
  return text.slice(text.length - tailChars)
}

function normalize(content: string): string {
  return content.replaceAll('\r\n', '\n').trim()
}

function hashContent(content: string): string {
  return createHash('sha256').update(normalize(content)).digest('hex')
}

export function chunk(markdown: string, opts: ChunkOptions): ChunkSpec[] {
  const stripped = (markdown || '').replaceAll(FENCED_CODE_RE, '\n\n')
  const normalized = stripped.replaceAll('\r\n', '\n').trim()
  if (!normalized) return []

  const paragraphs = normalized
    .split(PARAGRAPH_SPLIT_RE)
    .map((p) => p.trim())
    .filter(Boolean)

  const units: string[] = []
  for (const p of paragraphs) {
    units.push(...splitOversized(p, opts.maxTokens))
  }

  const packed: string[] = []
  let buffer = ''
  let bufferTokens = 0
  for (const unit of units) {
    const unitTokens = estimateTokens(unit)
    if (!buffer) {
      buffer = unit
      bufferTokens = unitTokens
      continue
    }
    if (bufferTokens + unitTokens <= opts.maxTokens) {
      buffer = `${buffer}\n\n${unit}`
      bufferTokens += unitTokens
    } else {
      packed.push(buffer)
      buffer = unit
      bufferTokens = unitTokens
    }
  }
  if (buffer) packed.push(buffer)

  if (opts.overlapTokens > 0 && packed.length > 1) {
    for (let i = 1; i < packed.length; i++) {
      const overlap = tailTokens(packed[i - 1], opts.overlapTokens)
      if (overlap) {
        packed[i] = `${overlap}\n\n${packed[i]}`
      }
    }
  }

  return packed.map((content, index) => ({
    index,
    content,
    hash: hashContent(content),
  }))
}
