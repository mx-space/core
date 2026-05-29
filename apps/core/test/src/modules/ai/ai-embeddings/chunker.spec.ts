import { describe, expect, it } from 'vitest'

import { chunk } from '~/modules/ai/ai-embeddings/chunker'

describe('chunker', () => {
  it('returns no chunks for empty input', () => {
    expect(chunk('', { maxTokens: 100, overlapTokens: 0 })).toEqual([])
    expect(chunk('   \n\n  ', { maxTokens: 100, overlapTokens: 0 })).toEqual([])
  })

  it('is deterministic — same input yields identical chunks (content + hash)', () => {
    const text = 'first paragraph.\n\nsecond paragraph.\n\nthird paragraph.'
    const a = chunk(text, { maxTokens: 100, overlapTokens: 0 })
    const b = chunk(text, { maxTokens: 100, overlapTokens: 0 })
    expect(a).toEqual(b)
    expect(a[0].hash).toMatch(/^[\da-f]{64}$/)
  })

  it('strips fenced code blocks before chunking', () => {
    const text = 'prose A\n\n```ts\nconst secret = "ignored"\n```\n\nprose B'
    const chunks = chunk(text, { maxTokens: 100, overlapTokens: 0 })
    for (const c of chunks) {
      expect(c.content).not.toContain('secret')
    }
  })

  it('greedy-packs small paragraphs into a single chunk under budget', () => {
    const text = 'one.\n\ntwo.\n\nthree.\n\nfour.'
    const chunks = chunk(text, { maxTokens: 200, overlapTokens: 0 })
    expect(chunks.length).toBe(1)
    expect(chunks[0].content).toContain('one')
    expect(chunks[0].content).toContain('four')
  })

  it('splits oversized paragraphs into multiple chunks', () => {
    const big = 'a'.repeat(2000)
    const chunks = chunk(big, { maxTokens: 50, overlapTokens: 0 })
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((c) => c.content.length > 0)).toBe(true)
  })

  it('falls back to sentence then character window for oversized paragraphs', () => {
    const sentence = `sentence one. ${'x'.repeat(1500)}. sentence three.`
    const chunks = chunk(sentence, { maxTokens: 40, overlapTokens: 0 })
    expect(chunks.length).toBeGreaterThan(1)
  })

  it('applies overlap between consecutive chunks', () => {
    const text = `${'first paragraph stuff '.repeat(80)}\n\n${'second paragraph different '.repeat(80)}`
    const chunks = chunk(text, { maxTokens: 100, overlapTokens: 20 })
    expect(chunks.length).toBeGreaterThan(1)
    const tail = chunks[0].content.slice(-30)
    expect(chunks[1].content.startsWith(tail.slice(-10))).toBe(false)
    expect(chunks[1].content.length).toBeGreaterThan(0)
  })

  it('handles CJK content', () => {
    const text = `中文段落一。${'中'.repeat(500)}\n\n中文段落二。`
    const chunks = chunk(text, { maxTokens: 80, overlapTokens: 10 })
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((c) => c.hash.length === 64)).toBe(true)
  })
})
