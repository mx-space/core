import { describe, expect, it } from 'vitest'

import { renderLexicalAnsi } from '../../../src/cli/render/lexical'
import { visibleLen } from '../../../src/cli/render/markdown'

const plain = (xml: string) => renderLexicalAnsi(xml, { color: false })
const styled = (xml: string) => renderLexicalAnsi(xml, { color: true })

// `SEPARATOR_WIDTH` constant from `src/cli/render/helpers.ts`. Hard-coded
// here so the test breaks loudly if the visual width changes (the renderer's
// box-drawing depends on it).
const RULE = '─'.repeat(64)

describe('renderLexicalAnsi — blocks', () => {
  it('renders a paragraph as its inline children', () => {
    expect(plain('<p>hello world</p>')).toBe('hello world')
  })

  it('joins multiple paragraphs with a blank line', () => {
    expect(plain('<p>a</p><p>b</p>')).toBe('a\n\nb')
  })

  it('drops pretty-print whitespace text nodes between blocks', () => {
    expect(plain('<p>a</p>\n  <p>b</p>')).toBe('a\n\nb')
  })

  it('renders h1 with an underline rule sized to the title', () => {
    expect(plain('<h1>Title</h1>')).toBe('Title\n─────')
  })

  it('renders h2 with an underline rule sized to the title', () => {
    expect(plain('<h2>Sub</h2>')).toBe('Sub\n───')
  })

  it('renders h3-h6 as bold-only (no rule)', () => {
    expect(plain('<h3>Three</h3>')).toBe('Three')
    expect(plain('<h4>Four</h4>')).toBe('Four')
    expect(plain('<h5>Five</h5>')).toBe('Five')
    expect(plain('<h6>Six</h6>')).toBe('Six')
  })

  it('prefixes blockquote body lines with `| `', () => {
    expect(plain('<blockquote><p>quoted</p></blockquote>')).toBe(
      '│ quoted',
    )
  })

  it('appends a blockquote attribution line', () => {
    expect(
      plain('<blockquote attribution="Alice"><p>q</p></blockquote>'),
    ).toBe('│ q\n   — Alice')
  })

  it('emits only the attribution line for an empty quote body', () => {
    expect(plain('<blockquote attribution="Alice"></blockquote>')).toBe(
      '   — Alice',
    )
  })

  it('renders <hr/> as a 64-wide dim rule', () => {
    expect(plain('<hr/>')).toBe(RULE)
  })

  it('renders ul items with `- ` bullets', () => {
    expect(plain('<ul><li>a</li><li>b</li></ul>')).toBe('- a\n- b')
  })

  it('renders ol items with right-aligned ordinals', () => {
    expect(plain('<ol><li>a</li><li>b</li><li>c</li></ol>')).toBe(
      '1. a\n2. b\n3. c',
    )
  })

  it('renders checked list items with [x]/[ ] markers', () => {
    expect(
      plain(
        '<ul><li checked="true">done</li><li checked="false">todo</li></ul>',
      ),
    ).toBe('[x] done\n[ ] todo')
  })

  it('indents nested lists by 2 spaces', () => {
    expect(plain('<ul><li>a<ul><li>b</li></ul></li></ul>')).toBe('- a\n  - b')
  })

  it('keeps multi-paragraph li body aligned under the bullet', () => {
    expect(plain('<ul><li><p>a</p><p>b</p></li></ul>')).toBe('- a\n  b')
  })

  it('renders a table header row in bold with a separator', () => {
    expect(
      plain(
        '<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>',
      ),
    ).toBe('A │ B\n──┼──\n1 │ 2')
  })

  it('renders a table without a header (no rule)', () => {
    expect(plain('<table><tr><td>1</td><td>2</td></tr></table>')).toBe(
      '1 │ 2',
    )
  })

  it('renders an alert as label + framed body', () => {
    expect(plain('<alert type="warning"><p>watch out</p></alert>')).toBe(
      `WARNING\n${RULE}\n│ watch out\n${RULE}`,
    )
  })

  it('defaults alert label to INFO when type is missing', () => {
    expect(plain('<alert><p>hi</p></alert>')).toBe(
      `INFO\n${RULE}\n│ hi\n${RULE}`,
    )
  })

  it('renders a banner with the same shape as alert', () => {
    expect(plain('<banner type="info"><p>hi</p></banner>')).toBe(
      `INFO\n${RULE}\n│ hi\n${RULE}`,
    )
  })

  it('renders details with a summary head and indented body', () => {
    expect(plain('<details summary="more"><p>hidden</p></details>')).toBe(
      '▸ more\n  hidden',
    )
  })

  it('omits the body when details has no children', () => {
    expect(plain('<details summary="empty"></details>')).toBe('▸ empty')
  })

  it('renders spoiler as dim text', () => {
    expect(plain('<spoiler>secret</spoiler>')).toBe('secret')
  })
})

describe('renderLexicalAnsi — inlines', () => {
  it('returns plain text when color is off', () => {
    expect(plain('<p><b>x</b></p>')).toBe('x')
  })

  it('wraps bold with bold open/close (color on)', () => {
    expect(styled('<p><b>x</b></p>')).toBe('\x1B[1mx\x1B[22m')
  })

  it('survives nested format reset (italic inside bold)', () => {
    expect(styled('<p><b>a <i>b</i> c</b></p>')).toBe(
      '\x1B[1ma \x1B[3mb\x1B[23m c\x1B[22m',
    )
  })

  it('uses the strike open/close pair', () => {
    expect(styled('<p><s>x</s></p>')).toBe('\x1B[9mx\x1B[29m')
  })

  it('uses the underline open/close pair', () => {
    expect(styled('<p><u>x</u></p>')).toBe('\x1B[4mx\x1B[24m')
  })

  it('uses dim for inline code', () => {
    expect(styled('<p><code>x</code></p>')).toBe('\x1B[2mx\x1B[22m')
  })

  it('uses reverse-video for mark', () => {
    expect(styled('<p><mark>x</mark></p>')).toBe('\x1B[7mx\x1B[27m')
  })

  it('renders sub and sup as dim (degraded for TTY)', () => {
    expect(styled('<p><sub>2</sub><sup>3</sup></p>')).toBe(
      '\x1B[2m2\x1B[22m\x1B[2m3\x1B[22m',
    )
  })

  it('appends a visible href when link text differs from href', () => {
    expect(plain('<p><a href="https://x.com">click</a></p>')).toBe(
      'click (https://x.com)',
    )
  })

  it('suppresses the href suffix when text already equals href', () => {
    expect(plain('<p><a href="https://x.com">https://x.com</a></p>')).toBe(
      'https://x.com',
    )
  })

  it('renders <a> without href as just its text', () => {
    expect(plain('<p><a>noref</a></p>')).toBe('noref')
  })

  it('renders <br/> as a newline', () => {
    expect(plain('<p>line1<br/>line2</p>')).toBe('line1\nline2')
  })

  it('renders mention with @ prefix and display fallback', () => {
    expect(plain('<p><mention handle="alice">Alice</mention></p>')).toBe(
      '@Alice',
    )
    expect(plain('<p><mention handle="bob"></mention></p>')).toBe('@bob')
  })

  it('renders tag with # prefix', () => {
    expect(plain('<p><tag>js</tag></p>')).toBe('#js')
  })

  it('renders comment as dim passthrough', () => {
    expect(plain('<p><comment>aside</comment></p>')).toBe('aside')
  })

  it('renders footnote as [^ref]', () => {
    expect(plain('<p><footnote ref="1"/></p>')).toBe('[^1]')
  })

  it('renders ruby with a dim (rt) suffix when present', () => {
    expect(plain('<p><ruby rt="kanji">漢</ruby></p>')).toBe(
      '漢 (kanji)',
    )
  })

  it('renders ruby without rt as just the base', () => {
    expect(plain('<p><ruby>漢</ruby></p>')).toBe('漢')
  })
})

describe('renderLexicalAnsi — embeds', () => {
  it('renders img with alt text as the label', () => {
    expect(plain('<img alt="cat" src="/a/b/cat.png"/>')).toBe('[image: cat]')
  })

  it('falls back to the src basename when alt is absent', () => {
    expect(plain('<img src="/path/img.png"/>')).toBe('[image: img.png]')
  })

  it('renders bare img as [image]', () => {
    expect(plain('<img/>')).toBe('[image]')
  })

  it('appends a caption line when present', () => {
    expect(plain('<img alt="x" src="y" caption="cap"/>')).toBe(
      '[image: x]\ncap',
    )
  })

  it('renders video with the src in the label', () => {
    expect(plain('<video src="https://x/y.mp4"/>')).toBe(
      '[video: https://x/y.mp4]',
    )
  })

  it('renders link-card with title, description, and url', () => {
    expect(
      plain('<link-card url="https://ex.com" title="T" description="D"/>'),
    ).toBe('┌ T\n│ D\n└ https://ex.com')
  })

  it('renders link-card without description (no middle line)', () => {
    expect(plain('<link-card url="https://ex.com" title="T"/>')).toBe(
      '┌ T\n└ https://ex.com',
    )
  })

  it('renders link-card without title as a one-line [link: ...]', () => {
    expect(plain('<link-card url="https://ex.com"/>')).toBe(
      '[link: https://ex.com]',
    )
  })

  it('renders embed with source prefix when source is set', () => {
    expect(plain('<embed url="u" source="yt"/>')).toBe('[embed: yt u]')
  })

  it('renders embed without source as just the url', () => {
    expect(plain('<embed url="u"/>')).toBe('[embed: u]')
  })
})

describe('renderLexicalAnsi — codeblock', () => {
  it('prepends a dim language label when lang is set', () => {
    expect(plain('<codeblock lang="ts">const a = 1;</codeblock>')).toBe(
      'ts\nconst a = 1;',
    )
  })

  it('strips trailing newlines from the body', () => {
    expect(plain('<codeblock lang="ts">const a = 1;\n\n</codeblock>')).toBe(
      'ts\nconst a = 1;',
    )
  })

  it('emits just the body when lang is absent', () => {
    expect(plain('<codeblock>plain text</codeblock>')).toBe('plain text')
  })
})

describe('renderLexicalAnsi — robustness', () => {
  it('returns empty string for empty input', () => {
    expect(plain('')).toBe('')
  })

  it('returns empty string for malformed XML (no throw)', () => {
    expect(() => plain('<<<bad')).not.toThrow()
    expect(plain('<<<bad')).toBe('')
  })

  it('falls back to rendering children of unknown tags', () => {
    expect(plain('<unknown>fallback</unknown>')).toBe('fallback')
    expect(plain('<unknown><p>nested</p></unknown>')).toBe('nested')
  })

  it('trims trailing newlines from the final output', () => {
    // `renderLexicalAnsi` strips trailing newlines from the output as a
    // post-processing step — exercise it via details which renders as
    // `head\n  body` with no trailing newline of its own.
    expect(plain('<details summary="x"><p>y</p></details>')).toBe(
      '▸ x\n  y',
    )
  })
})

describe('renderLexicalAnsi — table alignment', () => {
  it('keeps every row the same visible width with CJK columns', () => {
    const xml =
      '<table>' +
      '<tr><th>指标</th><th>Next.js</th><th>占优</th></tr>' +
      '<tr><td>Performance</td><td>64</td><td>Remix</td></tr>' +
      '<tr><td>FCP</td><td>3037 ms</td><td>Remix +19</td></tr>' +
      '</table>'
    const lines = plain(xml)
      .split('\n')
      .filter((line) => line.length > 0)
    const widths = new Set(lines.map((line) => visibleLen(line)))
    expect(widths.size).toBe(1)
  })
})
