import { describe, expect, it } from 'vitest'

import {
  renderMarkdownToAnsi,
  visibleLen,
} from '../../../src/cli/render/markdown'

describe('visibleLen', () => {
  it('counts ASCII as one column each', () => {
    expect(visibleLen('hello')).toBe(5)
  })

  it('counts CJK characters as two columns each', () => {
    expect(visibleLen('中文')).toBe(4)
    expect(visibleLen('指标')).toBe(4)
  })

  it('counts mixed CJK and ASCII by display width', () => {
    expect(visibleLen('中a文')).toBe(5)
  })

  it('counts fullwidth punctuation as two columns', () => {
    expect(visibleLen('（）')).toBe(4)
  })

  it('ignores ANSI escape sequences', () => {
    const esc = String.fromCharCode(0x1b)
    expect(visibleLen(`${esc}[1m中${esc}[0m`)).toBe(2)
  })

  it('counts an astral-plane CJK character as a single wide unit', () => {
    expect(visibleLen('𠀀')).toBe(2)
  })
})

describe('renderMarkdownToAnsi — table alignment', () => {
  it('keeps every row the same visible width with CJK columns', () => {
    const md = [
      '| 指标 | Next.js | 占优 |',
      '| --- | --- | --- |',
      '| Performance | 64 | Remix |',
      '| FCP | 3037 ms | Remix +19 |',
    ].join('\n')
    const lines = renderMarkdownToAnsi(md, { color: false })
      .split('\n')
      .filter((line) => line.length > 0)
    const widths = new Set(lines.map((line) => visibleLen(line)))
    expect(widths.size).toBe(1)
  })
})
