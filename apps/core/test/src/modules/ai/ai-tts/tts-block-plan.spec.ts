import { describe, expect, it } from 'vitest'

import {
  computeSpeechFingerprint,
  extractSpeakableText,
  planTts,
  SPEAKABLE_BLOCK_TYPES,
  splitIntoChunks,
} from '~/modules/ai/ai-tts/tts-block-plan'

const textNode = (text: string) => ({ type: 'text', text })

describe('SPEAKABLE_BLOCK_TYPES', () => {
  it('accepts prose blocks and rejects the rest', () => {
    expect(SPEAKABLE_BLOCK_TYPES.has('paragraph')).toBe(true)
    expect(SPEAKABLE_BLOCK_TYPES.has('heading')).toBe(true)
    expect(SPEAKABLE_BLOCK_TYPES.has('quote')).toBe(true)
    expect(SPEAKABLE_BLOCK_TYPES.has('rich-quote')).toBe(true)
    expect(SPEAKABLE_BLOCK_TYPES.has('list')).toBe(true)
    for (const type of [
      'code',
      'mermaid',
      'excalidraw',
      'image',
      'gallery',
      'table',
      'poll',
      'embed',
      'horizontalrule',
    ]) {
      expect(SPEAKABLE_BLOCK_TYPES.has(type)).toBe(false)
    }
  })
})

describe('extractSpeakableText', () => {
  it('joins list items with a separator instead of concatenating', () => {
    const list = {
      type: 'list',
      children: [
        { type: 'listitem', children: [textNode('ab')] },
        { type: 'listitem', children: [textNode('c')] },
      ],
    }
    expect(extractSpeakableText(list)).toBe('ab。c')
  })

  it('drops the url of a link but keeps its text', () => {
    const paragraph = {
      type: 'paragraph',
      children: [
        {
          type: 'link',
          url: 'https://example.com',
          children: [textNode('docs')],
        },
      ],
    }
    expect(extractSpeakableText(paragraph)).toBe('docs')
  })

  it('collapses whitespace', () => {
    const paragraph = {
      type: 'paragraph',
      children: [textNode('a   \n  b')],
    }
    expect(extractSpeakableText(paragraph)).toBe('a b')
  })
})

describe('computeSpeechFingerprint', () => {
  it('separates list splits that share concatenated text', () => {
    const left = {
      type: 'list',
      children: [
        { type: 'listitem', children: [textNode('ab')] },
        { type: 'listitem', children: [textNode('c')] },
      ],
    }
    const right = {
      type: 'list',
      children: [
        { type: 'listitem', children: [textNode('a')] },
        { type: 'listitem', children: [textNode('bc')] },
      ],
    }
    expect(
      computeSpeechFingerprint('list', extractSpeakableText(left)),
    ).not.toBe(computeSpeechFingerprint('list', extractSpeakableText(right)))
  })

  it('separates nested list splits that share concatenated text', () => {
    const nestedList = (a: string, b: string) => ({
      type: 'list',
      children: [
        {
          type: 'listitem',
          children: [
            {
              type: 'list',
              children: [
                { type: 'listitem', children: [textNode(a)] },
                { type: 'listitem', children: [textNode(b)] },
              ],
            },
          ],
        },
      ],
    })
    const left = nestedList('ab', 'c')
    const right = nestedList('a', 'bc')
    expect(
      computeSpeechFingerprint('list', extractSpeakableText(left)),
    ).not.toBe(computeSpeechFingerprint('list', extractSpeakableText(right)))
  })
})

describe('splitIntoChunks', () => {
  it('splits on sentence boundaries under the limit', () => {
    expect(splitIntoChunks('一。二。三。', 4)).toEqual(['一。二。', '三。'])
  })

  it('hard-cuts a single sentence longer than the limit', () => {
    expect(splitIntoChunks('a'.repeat(9), 4)).toEqual(['aaaa', 'aaaa', 'a'])
  })

  it('returns one chunk when the text fits', () => {
    expect(splitIntoChunks('short', 100)).toEqual(['short'])
  })

  it('rejects a non-positive maxChars up front instead of looping unboundedly', () => {
    expect(() => splitIntoChunks('a', 0)).toThrow(/maxChars must be a positive/)
    expect(() => splitIntoChunks('a', -1)).toThrow(
      /maxChars must be a positive/,
    )
  })
})

describe('planTts', () => {
  const chunk = (blockId: string, chunkIndex: number, fingerprint: string) => ({
    blockId,
    chunkIndex,
    type: 'paragraph',
    text: `${blockId}-${chunkIndex}`,
    fingerprint,
  })
  const row = (
    id: string,
    blockId: string,
    chunkIndex: number,
    fingerprint: string,
  ) => ({
    id,
    blockId,
    chunkIndex,
    fingerprint,
    storageBackend: 's3' as const,
    storageKey: `k/${id}`,
  })

  it('reuses a matching fingerprint and regenerates a changed one', () => {
    const plan = planTts({
      chunks: [chunk('a', 0, 'fp-a'), chunk('b', 0, 'fp-b2')],
      existing: [row('r1', 'a', 0, 'fp-a'), row('r2', 'b', 0, 'fp-b1')],
      force: false,
    })

    expect(plan.toReuse).toEqual([{ rowId: 'r1', blockId: 'a', chunkIndex: 0 }])
    expect(plan.toGenerate).toEqual([chunk('b', 0, 'fp-b2')])
    expect(plan.toDelete).toEqual([])
  })

  it('keeps a moved block reused and reflects the move in blockOrder', () => {
    const plan = planTts({
      chunks: [chunk('b', 0, 'fp-b'), chunk('a', 0, 'fp-a')],
      existing: [row('r1', 'a', 0, 'fp-a'), row('r2', 'b', 0, 'fp-b')],
      force: false,
    })

    expect(plan.toGenerate).toEqual([])
    expect(plan.blockOrder).toEqual(['b', 'a'])
  })

  it('deletes rows for removed blocks and trailing chunks', () => {
    const plan = planTts({
      chunks: [chunk('a', 0, 'fp-a')],
      existing: [
        row('r1', 'a', 0, 'fp-a'),
        row('r2', 'a', 1, 'fp-a1'),
        row('r3', 'gone', 0, 'fp-x'),
      ],
      force: false,
    })

    expect(plan.toDelete.map((d) => d.rowId).sort()).toEqual(['r2', 'r3'])
  })

  it('force regenerates everything and only deletes rows not being replaced', () => {
    const plan = planTts({
      chunks: [chunk('a', 0, 'fp-a')],
      existing: [row('r1', 'a', 0, 'fp-a'), row('r2', 'old', 0, 'fp-o')],
      force: true,
    })

    expect(plan.toGenerate).toHaveLength(1)
    expect(plan.toDelete.map((d) => d.rowId)).toEqual(['r2'])
  })

  it('sums charCount over the planned chunks', () => {
    const plan = planTts({
      chunks: [chunk('a', 0, 'fp-a'), chunk('b', 0, 'fp-b')],
      existing: [],
      force: false,
    })

    expect(plan.charCount).toBe(6)
  })

  it('dedupes blockOrder so a multi-chunk block appears once', () => {
    const plan = planTts({
      chunks: [chunk('a', 0, 'fp-a0'), chunk('a', 1, 'fp-a1')],
      existing: [],
      force: false,
    })

    expect(plan.blockOrder).toEqual(['a'])
  })
})
