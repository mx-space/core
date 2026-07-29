import { describe, expect, it } from 'vitest'

import { analyzeMxMarkdown, mxLexicalToMarkdown } from '../src'

function convertible(markdown: string) {
  const result = analyzeMxMarkdown(markdown, { profile: 'yohaku-v1' })
  if (result.status !== 'convertible') {
    throw new Error(
      result.issues
        .map((issue) => `${issue.code}: ${JSON.stringify(issue.details)}`)
        .join(', '),
    )
  }
  expect(result.status).toBe('convertible')
  return result
}

describe('analyzeMxMarkdown', () => {
  it('converts standard inline formats, links, and task lists behaviorally', () => {
    const result = convertible(`A **bold** ++insert++ ==mark== [link](https://example.com "title")

- [x] done
- [ ] pending`)

    const [paragraph, list] = result.content.root.children as any[]
    expect(paragraph.type).toBe('paragraph')
    expect(
      paragraph.children
        .filter((node: any) => node.type === 'text')
        .map((node: any) => [node.text, node.format]),
    ).toEqual(
      expect.arrayContaining([
        ['bold', 1],
        ['insert', 8],
        ['mark', 128],
      ]),
    )
    expect(paragraph.children).toContainEqual(
      expect.objectContaining({
        type: 'link',
        title: 'title',
        url: 'https://example.com',
      }),
    )
    expect(list).toMatchObject({ listType: 'check', type: 'list' })
    expect(list.children.map((item: any) => item.checked)).toEqual([true, false])
    expect(result.text).toContain(
      'A **bold** ++insert++ ==mark== [link](https://example.com "title")',
    )
  })

  it('merges CommonMark soft line breaks while preserving explicit hard breaks', () => {
    const result = convertible('soft line\ncontinues here\n\nhard line  \nbreak')
    const [soft, hard] = result.content.root.children as any[]

    expect(soft.children.map((node: any) => node.text ?? '\n').join('')).toBe(
      'soft line continues here',
    )
    expect(hard.children.map((node: any) => node.type)).toContain('linebreak')
  })

  it('converts Yohaku mention, spoiler, inline KaTeX, and bare URL syntax', () => {
    const source =
      'See [Innei]{GH@Innei}and ||secret||; $E = mc^2$ at https://example.com.'
    const result = analyzeMxMarkdown(source, {
      profile: 'yohaku-v1',
      blockIdFactory: (path) => `migration:${path}`,
    })

    expect(result.status).toBe('convertible')
    if (result.status !== 'convertible') return

    const paragraph = result.content.root.children[0] as any
    expect(paragraph.$.blockId).toBe('migration:root.children[0]')
    expect(paragraph.children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          displayName: 'Innei',
          handle: 'Innei',
          platform: 'GH',
          type: 'mention',
        }),
        expect.objectContaining({ type: 'spoiler' }),
        expect.objectContaining({ equation: 'E = mc^2', type: 'katex-inline' }),
        expect.objectContaining({
          type: 'autolink',
          url: 'https://example.com',
        }),
      ]),
    )
    expect(result.features.map((feature) => feature.feature)).toEqual([
      'mention',
      'spoiler',
      'katex-inline',
    ])

    const repeated = analyzeMxMarkdown(source, { profile: 'yohaku-v1' })
    expect(repeated.sourceHash).toBe(result.sourceHash)
    expect(result.sourceHash).toMatch(/^sha256:[a-f\d]{64}$/)
  })

  it('converts exact rich blocks and projects them back through the shared serializer', () => {
    const source = `\`\`\`ts
const answer = 42
\`\`\`

\`\`\`mermaid
flowchart LR
  A --> B
\`\`\`

$$
x^2 + y^2
$$

---

![Sea](https://example.com/sea.png "Caption")`
    const result = convertible(source)
    const children = result.content.root.children as any[]

    expect(children.map((node) => node.type)).toEqual([
      'code-block',
      'mermaid',
      'katex-block',
      'horizontalrule',
      'image',
    ])
    expect(children[0]).toMatchObject({
      code: 'const answer = 42',
      language: 'ts',
    })
    expect(children[1].diagram).toBe('flowchart LR\n  A --> B')
    expect(children[2].equation).toBe('x^2 + y^2')
    expect(children[4]).toMatchObject({
      altText: 'Sea',
      caption: 'Caption',
      src: 'https://example.com/sea.png',
    })

    const projected = mxLexicalToMarkdown(result.content)
    expect(projected).toContain('const answer = 42')
    expect(projected).toContain('```mermaid')
    expect(projected).toContain('https://example.com/sea.png')
  })

  it('returns source-located blockers for constructs without renderer parity', () => {
    const result = analyzeMxMarkdown(`# Legacy anchor

| A | B |
| :- | -: |
| 1 | 2 |

Footnote[^1]

[^1]: note

::: gallery
![x](https://example.com/x.png)
:::

<Tabs></Tabs>`, { profile: 'yohaku-v1' })

    expect(result.status).toBe('blocked')
    if (result.status !== 'blocked') return

    const codes = result.issues.map((issue) => issue.code)
    expect(codes).toEqual(
      expect.arrayContaining([
        'unsupported-heading-anchor-parity',
        'unsupported-table',
        'unsupported-footnote',
        'unsupported-reference-definition',
        'unsupported-container',
        'unsupported-raw-html',
      ]),
    )
    expect(result.issues[0].range.start).toMatchObject({
      column: 1,
      line: 1,
      offset: 0,
    })
    expect(
      result.issues.every(
        (issue) => issue.range.end.offset >= issue.range.start.offset,
      ),
    ).toBe(true)
  })

  it('does not treat unsupported-looking content inside a code fence as syntax', () => {
    const result = convertible(`\`\`\`md
# heading
::: gallery
<script>alert(1)</script>
[^1]
\`\`\``)

    expect(result.content.root.children).toEqual([
      expect.objectContaining({
        code: '# heading\n::: gallery\n<script>alert(1)</script>\n[^1]',
        language: 'md',
        type: 'code-block',
      }),
    ])
  })

  it('keeps malformed custom tokens literal instead of interpreting them more aggressively', () => {
    const result = convertible('Literal {XX@name}, {GH@dash-name}, and unclosed ||text.')
    const paragraph = result.content.root.children[0] as any
    expect(paragraph.children.map((node: any) => node.text).join('')).toBe(
      'Literal {XX@name}, {GH@dash-name}, and unclosed ||text.',
    )
  })

  it('distinguishes a thematic break from an unsupported Setext heading', () => {
    expect(convertible('Before\n\n---\n\nAfter').content.root.children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'horizontalrule' }),
      ]),
    )

    const setext = analyzeMxMarkdown('Heading\n---', {
      profile: 'yohaku-v1',
    })
    expect(setext.status).toBe('blocked')
    if (setext.status === 'blocked') {
      expect(setext.issues[0]).toMatchObject({
        code: 'unsupported-heading-anchor-parity',
        range: { start: { line: 1 }, end: { line: 2 } },
      })
    }
  })
})
