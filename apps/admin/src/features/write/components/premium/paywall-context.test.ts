import { describe, expect, it } from 'vitest'

import {
  blockPreviewText,
  blockType,
  selectContextBlocks,
} from './paywall-context'

const paragraph = (text: string) => ({
  children: [{ text, type: 'text' }],
  type: 'paragraph',
})

const blocks = ['a', 'b', 'c', 'd', 'e'].map(paragraph)

describe('selectContextBlocks', () => {
  it('returns two blocks before the cut, the cut and the first locked block', () => {
    expect(selectContextBlocks(blocks, 3)).toEqual({
      after: blocks[3],
      before: [blocks[0], blocks[1]],
      cut: blocks[2],
    })
  })

  it('shrinks the before window near the start', () => {
    expect(selectContextBlocks(blocks, 1)).toEqual({
      after: blocks[1],
      before: [],
      cut: blocks[0],
    })
    expect(selectContextBlocks(blocks, 2).before).toEqual([blocks[0]])
  })

  it('clamps value into the block range', () => {
    expect(selectContextBlocks(blocks, 99)).toEqual({
      after: undefined,
      before: [blocks[2], blocks[3]],
      cut: blocks[4],
    })
    expect(selectContextBlocks(blocks, 0).cut).toBe(blocks[0])
  })
})

describe('blockPreviewText', () => {
  it('collapses whitespace and truncates long text', () => {
    expect(blockPreviewText(paragraph('  hello \n  world  '))).toBe(
      'hello world',
    )
    const long = blockPreviewText(paragraph('x'.repeat(200)))
    expect(long).toHaveLength(161)
    expect(long.endsWith('…')).toBe(true)
  })

  it('returns an empty string for non-text blocks', () => {
    expect(blockPreviewText({ type: 'image' })).toBe('')
    expect(blockType({ type: 'image' })).toBe('image')
    expect(blockType(null)).toBe('unknown')
  })
})
