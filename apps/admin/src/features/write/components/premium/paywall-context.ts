import { collectLexicalText } from './lexical-blocks'

export const CONTEXT_BEFORE_COUNT = 2
export const PREVIEW_TEXT_LENGTH = 160

export interface ContextBlocks {
  after?: unknown
  before: unknown[]
  cut: unknown
}

export function selectContextBlocks(
  blocks: unknown[],
  value: number,
): ContextBlocks {
  const cutIndex = Math.min(Math.max(1, value), blocks.length) - 1
  return {
    after: blocks[cutIndex + 1],
    before: blocks.slice(
      Math.max(0, cutIndex - CONTEXT_BEFORE_COUNT),
      cutIndex,
    ),
    cut: blocks[cutIndex],
  }
}

export function blockType(block: unknown): string {
  if (typeof block !== 'object' || block === null) return 'unknown'
  const type = (block as { type?: unknown }).type
  return typeof type === 'string' ? type : 'unknown'
}

export function blockPreviewText(block: unknown): string {
  const text = collectLexicalText(block).replaceAll(/\s+/g, ' ').trim()
  return text.length > PREVIEW_TEXT_LENGTH
    ? `${text.slice(0, PREVIEW_TEXT_LENGTH)}…`
    : text
}
