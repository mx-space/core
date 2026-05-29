import { describe, expect, it } from 'vitest'

import {
  applyParagraphPatches,
  joinMarkdownParagraphs,
  splitMarkdownIntoParagraphs,
} from '~/modules/ai/ai-translation/markdown-paragraph-splitter'

describe('markdown-paragraph-splitter', () => {
  it('splits text into paragraphs by blank lines', () => {
    const md = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.'
    const parts = splitMarkdownIntoParagraphs(md)
    expect(parts.map((p) => p.id)).toEqual(['text:p0', 'text:p1', 'text:p2'])
    expect(parts[0].text).toBe('First paragraph.')
    expect(parts[1].text).toBe('Second paragraph.')
    expect(parts[2].text).toBe('Third paragraph.')
  })

  it('keeps a fenced code block as a single paragraph', () => {
    const md = [
      'Before.',
      '',
      '```ts',
      'const x = 1',
      '',
      'const y = 2',
      '```',
      '',
      'After.',
    ].join('\n')
    const parts = splitMarkdownIntoParagraphs(md)
    expect(parts).toHaveLength(3)
    expect(parts[0].text).toBe('Before.')
    expect(parts[1].text).toContain('```ts')
    expect(parts[1].text).toContain('const x = 1')
    expect(parts[1].text).toContain('const y = 2')
    expect(parts[1].text).toContain('```')
    expect(parts[2].text).toBe('After.')
  })

  it('treats tilde fences and longer markers correctly', () => {
    const md = ['A', '', '~~~~', 'inner ~~~ not closing', '~~~~', '', 'B'].join(
      '\n',
    )
    const parts = splitMarkdownIntoParagraphs(md)
    expect(parts).toHaveLength(3)
    expect(parts[1].text).toContain('inner ~~~ not closing')
    expect(parts[2].text).toBe('B')
  })

  it('preserves nested list markers and indentation', () => {
    const md = ['- item 1', '  - nested 1', '  - nested 2', '- item 2'].join(
      '\n',
    )
    const parts = splitMarkdownIntoParagraphs(md)
    expect(parts).toHaveLength(1)
    expect(parts[0].text).toBe(md)
  })

  it('collapses leading/trailing blank lines into empty result', () => {
    const md = '\n\n  \n\n'
    expect(splitMarkdownIntoParagraphs(md)).toEqual([])
  })

  it('round-trips when joined back together', () => {
    const md = 'A.\n\nB.\n\n```\ncode\n```\n\nC.'
    const parts = splitMarkdownIntoParagraphs(md)
    expect(joinMarkdownParagraphs(parts)).toBe(md)
  })

  it('applyParagraphPatches replaces only known IDs', () => {
    const md = 'Old A.\n\nOld B.\n\nOld C.'
    const result = applyParagraphPatches(md, {
      'text:p0': 'New A.',
      'text:p2': 'New C.',
      'text:p99': 'bogus',
    })
    expect(result.appliedIds).toEqual(['text:p0', 'text:p2'])
    expect(result.unknownIds).toEqual(['text:p99'])
    expect(result.joined).toBe('New A.\n\nOld B.\n\nNew C.')
  })

  it('treats a code block separated by only inline blank line correctly', () => {
    const md = ['```', 'line1', '', 'line3', '```'].join('\n')
    const parts = splitMarkdownIntoParagraphs(md)
    expect(parts).toHaveLength(1)
    expect(parts[0].text).toContain('line1')
    expect(parts[0].text).toContain('line3')
  })
})
