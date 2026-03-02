import { Test } from '@nestjs/testing'

import { LexicalService } from '~/processors/helper/helper.lexical.service'
import { ContentFormat } from '~/shared/types/content-format.type'

function makeEditorState(children: any[]) {
  return JSON.stringify({
    root: {
      children,
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  })
}

function textNode(text: string, format = 0) {
  return {
    detail: 0,
    format,
    mode: 'normal',
    style: '',
    text,
    type: 'text',
    version: 1,
  }
}

function paragraph(...children: any[]) {
  return {
    children,
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'paragraph',
    version: 1,
  }
}

function nestedState(text: string) {
  return {
    root: {
      children: [
        {
          children: [{ type: 'text', text, version: 1 }],
          type: 'paragraph',
          version: 1,
          direction: 'ltr',
          format: '',
          indent: 0,
        },
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  }
}

function tableCell(text: string, headerState = 0) {
  return {
    type: 'tablecell',
    version: 1,
    headerState,
    colSpan: 1,
    rowSpan: 1,
    width: null,
    backgroundColor: null,
    children: [paragraph(textNode(text))],
    direction: 'ltr',
    format: '',
    indent: 0,
  }
}

function tableRow(...cells: any[]) {
  return {
    type: 'tablerow',
    version: 1,
    children: cells,
    direction: 'ltr',
    format: '',
    indent: 0,
  }
}

describe('LexicalService', () => {
  let service: LexicalService

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [LexicalService],
    }).compile()
    service = moduleRef.get(LexicalService)
  })

  // ── Standard Lexical nodes ──

  it('converts paragraph', () => {
    const state = makeEditorState([paragraph(textNode('Hello world'))])
    const md = service.lexicalToMarkdown(state)
    expect(md).toContain('Hello world')
  })

  it('converts heading h1-h6', () => {
    for (const [tag, prefix] of [
      ['h1', '#'],
      ['h2', '##'],
      ['h3', '###'],
    ] as const) {
      const state = makeEditorState([
        {
          children: [textNode('Title')],
          direction: 'ltr',
          format: '',
          indent: 0,
          type: 'heading',
          version: 1,
          tag,
        },
      ])
      const md = service.lexicalToMarkdown(state)
      expect(md).toContain(`${prefix} Title`)
    }
  })

  it('converts bold text', () => {
    const state = makeEditorState([paragraph(textNode('bold', 1))])
    expect(service.lexicalToMarkdown(state)).toContain('**bold**')
  })

  it('converts italic text', () => {
    const state = makeEditorState([paragraph(textNode('italic', 2))])
    expect(service.lexicalToMarkdown(state)).toContain('*italic*')
  })

  it('converts inline code', () => {
    const state = makeEditorState([paragraph(textNode('code', 16))])
    expect(service.lexicalToMarkdown(state)).toContain('`code`')
  })

  it('converts strikethrough', () => {
    const state = makeEditorState([paragraph(textNode('del', 4))])
    expect(service.lexicalToMarkdown(state)).toContain('~~del~~')
  })

  it('converts underline (insert)', () => {
    const state = makeEditorState([paragraph(textNode('ins', 8))])
    expect(service.lexicalToMarkdown(state)).toContain('++ins++')
  })

  it('converts unordered list', () => {
    const state = makeEditorState([
      {
        children: [
          {
            children: [textNode('a')],
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'listitem',
            version: 1,
            value: 1,
          },
          {
            children: [textNode('b')],
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'listitem',
            version: 1,
            value: 2,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'list',
        version: 1,
        listType: 'bullet',
        start: 1,
        tag: 'ul',
      },
    ])
    const md = service.lexicalToMarkdown(state)
    expect(md).toContain('- a')
    expect(md).toContain('- b')
  })

  it('converts ordered list', () => {
    const state = makeEditorState([
      {
        children: [
          {
            children: [textNode('first')],
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'listitem',
            version: 1,
            value: 1,
          },
          {
            children: [textNode('second')],
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'listitem',
            version: 1,
            value: 2,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'list',
        version: 1,
        listType: 'number',
        start: 1,
        tag: 'ol',
      },
    ])
    const md = service.lexicalToMarkdown(state)
    expect(md).toContain('1. first')
    expect(md).toContain('2. second')
  })

  it('converts blockquote', () => {
    const state = makeEditorState([
      {
        children: [textNode('quoted')],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'quote',
        version: 1,
      },
    ])
    expect(service.lexicalToMarkdown(state)).toContain('> quoted')
  })

  it('handles legacy lexical code node as plain text fallback', () => {
    const state = makeEditorState([
      {
        children: [textNode('x=1')],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'code',
        version: 1,
        language: 'python',
      },
    ])
    const md = service.lexicalToMarkdown(state)
    expect(md.trim()).toBe('```python\nx=1\n```')
  })

  it('converts link', () => {
    const state = makeEditorState([
      paragraph({
        children: [textNode('click')],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'link',
        version: 1,
        rel: null,
        target: null,
        title: null,
        url: 'https://example.com',
      }),
    ])
    expect(service.lexicalToMarkdown(state)).toContain(
      '[click](https://example.com)',
    )
  })

  it('converts complex document', () => {
    const state = makeEditorState([
      {
        children: [textNode('My Post')],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'heading',
        version: 1,
        tag: 'h1',
      },
      paragraph(
        textNode('This is '),
        textNode('important', 1),
        textNode(' text.'),
      ),
    ])
    const md = service.lexicalToMarkdown(state)
    expect(md).toContain('# My Post')
    expect(md).toContain('**important**')
  })

  // ── Custom inline nodes (TextMatch / TextFormat) ──

  describe('spoiler', () => {
    it('exports ||text||', () => {
      const state = makeEditorState([
        paragraph({
          type: 'spoiler',
          version: 1,
          children: [textNode('secret')],
          direction: 'ltr',
          format: '',
          indent: 0,
        }),
      ])
      expect(service.lexicalToMarkdown(state)).toContain('||secret||')
    })
  })

  describe('mention', () => {
    it('exports without displayName', () => {
      const state = makeEditorState([
        paragraph({
          type: 'mention',
          version: 1,
          platform: 'twitter',
          handle: 'innei',
        }),
      ])
      expect(service.lexicalToMarkdown(state)).toContain('{twitter@innei}')
    })

    it('exports with displayName', () => {
      const state = makeEditorState([
        paragraph({
          type: 'mention',
          version: 1,
          platform: 'github',
          handle: 'innei',
          displayName: 'Innei',
        }),
      ])
      expect(service.lexicalToMarkdown(state)).toContain(
        '[Innei]{github@innei}',
      )
    })
  })

  describe('footnote inline', () => {
    it('exports [^id]', () => {
      const state = makeEditorState([
        paragraph({ type: 'footnote', version: 1, identifier: 'ref1' }),
      ])
      expect(service.lexicalToMarkdown(state)).toContain('[^ref1]')
    })
  })

  describe('katex-inline', () => {
    it('exports $equation$', () => {
      const state = makeEditorState([
        paragraph({ type: 'katex-inline', version: 1, equation: 'E=mc^2' }),
      ])
      expect(service.lexicalToMarkdown(state)).toContain('$E=mc^2$')
    })
  })

  describe('katex-block', () => {
    it('exports $$equation$$', () => {
      const state = makeEditorState([
        paragraph({
          type: 'katex-block',
          version: 1,
          equation: '\\int_0^1 x\\,dx',
        }),
      ])
      expect(service.lexicalToMarkdown(state)).toContain('$$\\int_0^1 x\\,dx$$')
    })
  })

  // ── Custom block nodes (Element transformers) ──

  describe('image', () => {
    it('exports without caption', () => {
      const state = makeEditorState([
        {
          type: 'image',
          version: 1,
          src: 'https://img.example.com/a.png',
          altText: 'photo',
        },
      ])
      expect(service.lexicalToMarkdown(state)).toContain(
        '![photo](https://img.example.com/a.png)',
      )
    })

    it('exports with caption', () => {
      const state = makeEditorState([
        {
          type: 'image',
          version: 1,
          src: 'https://img.example.com/a.png',
          altText: 'photo',
          caption: 'Fig 1',
        },
      ])
      expect(service.lexicalToMarkdown(state)).toContain(
        '![photo](https://img.example.com/a.png "Fig 1")',
      )
    })

    it('escapes quotes in caption', () => {
      const state = makeEditorState([
        {
          type: 'image',
          version: 1,
          src: 'https://x.com/a.png',
          altText: '',
          caption: 'a "b" c',
        },
      ])
      expect(service.lexicalToMarkdown(state)).toContain('"a \\"b\\" c"')
    })
  })

  describe('video', () => {
    it('exports src-only video', () => {
      const state = makeEditorState([
        { type: 'video', version: 1, src: 'https://v.example.com/v.mp4' },
      ])
      const md = service.lexicalToMarkdown(state)
      expect(md).toContain(
        '<video src="https://v.example.com/v.mp4" controls></video>',
      )
    })

    it('exports video with all attrs', () => {
      const state = makeEditorState([
        {
          type: 'video',
          version: 1,
          src: 'https://v.example.com/v.mp4',
          poster: 'https://p.jpg',
          width: 1920,
          height: 1080,
        },
      ])
      const md = service.lexicalToMarkdown(state)
      expect(md).toContain('poster="https://p.jpg"')
      expect(md).toContain('width=1920')
      expect(md).toContain('height=1080')
    })
  })

  describe('code-block (custom)', () => {
    it('exports fenced code', () => {
      const state = makeEditorState([
        {
          type: 'code-block',
          version: 1,
          code: 'console.log(1)',
          language: 'typescript',
        },
      ])
      const md = service.lexicalToMarkdown(state)
      expect(md).toContain('```typescript')
      expect(md).toContain('console.log(1)')
    })

    it('uses wider fence when code contains backticks', () => {
      const code = 'const s = ```test```'
      const state = makeEditorState([
        { type: 'code-block', version: 1, code, language: '' },
      ])
      const md = service.lexicalToMarkdown(state)
      expect(md).toContain('````')
      expect(md).toContain(code)
    })
  })

  describe('link-card', () => {
    it('exports titled link', () => {
      const state = makeEditorState([
        {
          type: 'link-card',
          version: 1,
          url: 'https://example.com',
          title: 'Example',
        },
      ])
      expect(service.lexicalToMarkdown(state)).toContain(
        '[Example](https://example.com)',
      )
    })

    it('exports bare url when no title', () => {
      const state = makeEditorState([
        { type: 'link-card', version: 1, url: 'https://example.com' },
      ])
      expect(service.lexicalToMarkdown(state)).toContain(
        '<https://example.com>',
      )
    })
  })

  describe('mermaid', () => {
    it('exports mermaid fenced block', () => {
      const state = makeEditorState([
        { type: 'mermaid', version: 1, diagram: 'graph TD\n  A-->B' },
      ])
      const md = service.lexicalToMarkdown(state)
      expect(md).toContain('```mermaid')
      expect(md).toContain('A-->B')
    })
  })

  describe('horizontalrule', () => {
    it('exports ---', () => {
      const state = makeEditorState([{ type: 'horizontalrule', version: 1 }])
      expect(service.lexicalToMarkdown(state)).toContain('---')
    })
  })

  describe('banner', () => {
    it('exports ::: type content :::', () => {
      const state = makeEditorState([
        {
          type: 'banner',
          version: 1,
          bannerType: 'warning',
          content: nestedState('Danger ahead'),
        },
      ])
      const md = service.lexicalToMarkdown(state)
      expect(md).toContain('::: warning')
      expect(md).toContain('Danger ahead')
      expect(md).toContain(':::')
    })

    it('defaults to note type', () => {
      const state = makeEditorState([
        { type: 'banner', version: 1, content: nestedState('Info') },
      ])
      expect(service.lexicalToMarkdown(state)).toContain('::: note')
    })
  })

  describe('alert-quote', () => {
    it.each([
      ['note', 'NOTE'],
      ['tip', 'TIP'],
      ['important', 'IMPORTANT'],
      ['warning', 'WARNING'],
      ['caution', 'CAUTION'],
    ])('exports %s as > [!%s]', (type, key) => {
      const state = makeEditorState([
        {
          type: 'alert-quote',
          version: 1,
          alertType: type,
          content: nestedState('msg'),
        },
      ])
      const md = service.lexicalToMarkdown(state)
      expect(md).toContain(`> [!${key}]`)
      expect(md).toContain('> msg')
    })

    it('defaults to NOTE', () => {
      const state = makeEditorState([
        { type: 'alert-quote', version: 1, content: nestedState('default') },
      ])
      expect(service.lexicalToMarkdown(state)).toContain('> [!NOTE]')
    })
  })

  describe('details', () => {
    it('exports ::: details{summary="..."} content :::', () => {
      const state = makeEditorState([
        {
          type: 'details',
          version: 1,
          summary: 'Expand me',
          open: false,
          children: [paragraph(textNode('Hidden content'))],
          direction: 'ltr',
          format: '',
          indent: 0,
        },
      ])
      const md = service.lexicalToMarkdown(state)
      expect(md).toContain('::: details{summary="Expand me"}')
      expect(md).toContain('Hidden content')
    })

    it('escapes quotes in summary', () => {
      const state = makeEditorState([
        {
          type: 'details',
          version: 1,
          summary: 'say "hello"',
          children: [paragraph(textNode('body'))],
          direction: 'ltr',
          format: '',
          indent: 0,
        },
      ])
      expect(service.lexicalToMarkdown(state)).toContain('say \\"hello\\"')
    })
  })

  describe('footnote-section', () => {
    it('exports [^id]: content lines', () => {
      const state = makeEditorState([
        {
          type: 'footnote-section',
          version: 1,
          definitions: { a: 'Alpha', b: 'Beta' },
        },
      ])
      const md = service.lexicalToMarkdown(state)
      expect(md).toContain('[^a]: Alpha')
      expect(md).toContain('[^b]: Beta')
    })

    it('handles empty definitions', () => {
      const state = makeEditorState([
        { type: 'footnote-section', version: 1, definitions: {} },
      ])
      const md = service.lexicalToMarkdown(state)
      expect(md).not.toContain('[^')
    })
  })

  describe('grid-container', () => {
    it('exports grid with cells', () => {
      const state = makeEditorState([
        {
          type: 'grid-container',
          version: 1,
          cols: 3,
          gap: '8px',
          cells: [nestedState('A'), nestedState('B')],
        },
      ])
      const md = service.lexicalToMarkdown(state)
      expect(md).toContain('::: grid{cols=3 gap="8px"}')
      expect(md).toContain('::: cell')
      expect(md).toContain('A')
      expect(md).toContain('B')
    })

    it('defaults cols=2 gap=16px', () => {
      const state = makeEditorState([
        { type: 'grid-container', version: 1, cells: [nestedState('X')] },
      ])
      const md = service.lexicalToMarkdown(state)
      expect(md).toContain('cols=2')
      expect(md).toContain('gap="16px"')
    })
  })

  describe('code-snippet', () => {
    it('exports multi-file snippet', () => {
      const state = makeEditorState([
        {
          type: 'code-snippet',
          version: 1,
          files: [
            { filename: 'main.ts', language: 'typescript', code: 'import x' },
            {
              filename: 'util.ts',
              language: 'typescript',
              code: 'export const y = 1',
            },
          ],
        },
      ])
      const md = service.lexicalToMarkdown(state)
      expect(md).toContain('::: code-snippet')
      expect(md).toContain('file{name="main.ts" lang="typescript"}')
      expect(md).toContain('import x')
      expect(md).toContain('file{name="util.ts" lang="typescript"}')
      expect(md).toContain('export const y = 1')
    })

    it('handles empty files', () => {
      const state = makeEditorState([
        { type: 'code-snippet', version: 1, files: [] },
      ])
      const md = service.lexicalToMarkdown(state)
      expect(md).toContain('::: code-snippet')
    })
  })

  describe('embed', () => {
    it('exports <url>', () => {
      const state = makeEditorState([
        { type: 'embed', version: 1, url: 'https://youtube.com/watch?v=abc' },
      ])
      expect(service.lexicalToMarkdown(state)).toContain(
        '<https://youtube.com/watch?v=abc>',
      )
    })
  })

  describe('gallery', () => {
    it('exports multiple images', () => {
      const state = makeEditorState([
        {
          type: 'gallery',
          version: 1,
          images: [
            { src: 'https://a.jpg', alt: 'A' },
            { src: 'https://b.jpg', alt: 'B' },
          ],
        },
      ])
      const md = service.lexicalToMarkdown(state)
      expect(md).toContain('![A](https://a.jpg)')
      expect(md).toContain('![B](https://b.jpg)')
    })

    it('handles empty gallery', () => {
      const state = makeEditorState([
        { type: 'gallery', version: 1, images: [] },
      ])
      service.lexicalToMarkdown(state)
    })
  })

  describe('excalidraw', () => {
    it('exports <excalidraw> wrapper', () => {
      const state = makeEditorState([
        { type: 'excalidraw', version: 1, snapshot: '{"shapes":[]}' },
      ])
      const md = service.lexicalToMarkdown(state)
      expect(md).toContain('<excalidraw>')
      expect(md).toContain('{"shapes":[]}')
      expect(md).toContain('</excalidraw>')
    })
  })

  describe('table', () => {
    it('exports markdown table', () => {
      const state = makeEditorState([
        {
          type: 'table',
          version: 1,
          children: [
            tableRow(tableCell('Name', 1), tableCell('Age', 1)),
            tableRow(tableCell('Alice'), tableCell('30')),
          ],
          direction: 'ltr',
          format: '',
          indent: 0,
        },
      ])
      const md = service.lexicalToMarkdown(state)
      expect(md).toContain('| Name | Age |')
      expect(md).toContain('| --- | --- |')
      expect(md).toContain('| Alice | 30 |')
    })

    it('escapes pipe in cell content', () => {
      const state = makeEditorState([
        {
          type: 'table',
          version: 1,
          children: [tableRow(tableCell('a|b', 1)), tableRow(tableCell('c'))],
          direction: 'ltr',
          format: '',
          indent: 0,
        },
      ])
      const md = service.lexicalToMarkdown(state)
      expect(md).toContain('a\\|b')
    })
  })

  // ── populateText ──

  describe('populateText', () => {
    it('returns true and sets text for Lexical content', () => {
      const state = makeEditorState([paragraph(textNode('Hello'))])
      const doc = {
        contentFormat: ContentFormat.Lexical,
        content: state,
        text: '',
      }
      expect(service.populateText(doc)).toBe(true)
      expect(doc.text).toContain('Hello')
      const parsed = JSON.parse(doc.content!)
      expect(parsed.root.children[0].$.blockId).toMatch(/^[\w-]{8}$/)
    })

    it('returns false for Markdown format', () => {
      const doc = {
        contentFormat: ContentFormat.Markdown,
        content: '# hi',
        text: '',
      }
      expect(service.populateText(doc)).toBe(false)
      expect(doc.text).toBe('')
    })

    it('returns false when content is empty string', () => {
      const doc = {
        contentFormat: ContentFormat.Lexical,
        content: '',
        text: '',
      }
      expect(service.populateText(doc)).toBe(false)
    })

    it('returns false when content is undefined', () => {
      const doc = {
        contentFormat: ContentFormat.Lexical,
        content: undefined,
        text: '',
      }
      expect(service.populateText(doc)).toBe(false)
    })

    it('returns false when contentFormat is missing', () => {
      const doc = { content: 'x', text: '' } as any
      expect(service.populateText(doc)).toBe(false)
    })
  })

  describe('normalizeBlockIds', () => {
    it('adds missing block ids and deduplicates repeated ids', () => {
      const state = makeEditorState([
        { ...paragraph(textNode('A')), $: { blockId: 'same-id' } } as any,
        { ...paragraph(textNode('B')), $: { blockId: 'same-id' } } as any,
        paragraph(textNode('C')),
      ])

      const normalized = service.normalizeBlockIds(state)

      expect(normalized.changed).toBe(true)
      const parsed = JSON.parse(normalized.content)
      const ids = parsed.root.children.map((child: any) => child.$.blockId)
      expect(ids).toHaveLength(3)
      expect(new Set(ids).size).toBe(3)
    })

    it('keeps content unchanged when block ids are already valid', () => {
      const state = makeEditorState([
        { ...paragraph(textNode('A')), $: { blockId: 'abcd1234' } } as any,
        { ...paragraph(textNode('B')), $: { blockId: 'wxyz5678' } } as any,
      ])

      const normalized = service.normalizeBlockIds(state)

      expect(normalized.changed).toBe(false)
      expect(normalized.content).toBe(state)
    })
  })

  describe('extractRootBlocks', () => {
    it('extracts root block metadata from lexical content', () => {
      const state = makeEditorState([
        {
          ...paragraph(textNode('Hello')),
          $: { blockId: 'hello123' },
        } as any,
        {
          type: 'code-block',
          version: 1,
          language: 'ts',
          code: 'const a = 1',
          $: { blockId: 'code1234' },
        },
      ])

      const blocks = service.extractRootBlocks(state)

      expect(blocks).toHaveLength(2)
      expect(blocks[0].id).toBe('hello123')
      expect(blocks[0].type).toBe('paragraph')
      expect(blocks[0].text).toContain('Hello')
      expect(blocks[1].id).toBe('code1234')
      expect(blocks[1].text).toContain('const a = 1')
    })
  })

  // ── Error handling ──

  describe('error handling', () => {
    it('throws on invalid JSON', () => {
      expect(() => service.lexicalToMarkdown('not json')).toThrow()
    })

    it('throws on malformed state', () => {
      expect(() =>
        service.lexicalToMarkdown(JSON.stringify({ root: null })),
      ).toThrow()
    })
  })

  // ── Integration: Shiroi fixture samples ──

  describe('integration: fixture samples', () => {
    const FORMAT_BOLD = 1
    const FORMAT_ITALIC = 2
    const FORMAT_CODE = 16

    function heading(tag: string, ...children: any[]) {
      return {
        children,
        direction: 'ltr',
        format: '',
        indent: 0,
        tag,
        type: 'heading',
        version: 1,
      }
    }

    function quote(...children: any[]) {
      return {
        children,
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'quote',
        version: 1,
      }
    }

    function link(url: string, ...children: any[]) {
      return {
        children,
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'link',
        version: 1,
        rel: null,
        target: null,
        title: null,
        url,
      }
    }

    function list(listType: string, ...children: any[]) {
      return {
        children,
        direction: 'ltr',
        format: '',
        indent: 0,
        listType,
        start: 1,
        tag: listType === 'bullet' ? 'ul' : 'ol',
        type: 'list',
        version: 1,
      }
    }

    function listItem(...children: any[]) {
      return {
        children,
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'listitem',
        version: 1,
        value: 1,
      }
    }

    function alertQuote(alertType: string, ...children: any[]) {
      return {
        type: 'alert-quote',
        alertType,
        content: {
          root: {
            children,
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'root',
            version: 1,
          },
        },
        version: 1,
      }
    }

    function banner(bannerType: string, ...children: any[]) {
      return {
        type: 'banner',
        bannerType,
        content: {
          root: {
            children,
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'root',
            version: 1,
          },
        },
        version: 1,
      }
    }

    function hr() {
      return { type: 'horizontalrule', version: 1 }
    }

    it('spoiler sample: inline spoiler within paragraph', () => {
      const state = makeEditorState([
        paragraph(
          textNode('This is a '),
          {
            type: 'spoiler',
            children: [textNode('hidden spoiler text')],
            version: 1,
            direction: 'ltr',
            format: '',
            indent: 0,
          } as any,
          textNode(' that reveals on hover.'),
        ),
      ])
      const md = service.lexicalToMarkdown(state)
      expect(md).toContain('||hidden spoiler text||')
      expect(md).toContain('This is a')
      expect(md).toContain('that reveals on hover.')
    })

    it('katex-inline sample: Einstein equation', () => {
      const state = makeEditorState([
        paragraph(
          textNode("Einstein's famous equation is "),
          { type: 'katex-inline', equation: 'E = mc^2', version: 1 } as any,
          textNode(' which describes mass-energy equivalence.'),
        ),
      ])
      const md = service.lexicalToMarkdown(state)
      expect(md).toContain('$E = mc^2$')
    })

    it('mention sample: multiple mentions', () => {
      const state = makeEditorState([
        paragraph(
          textNode('Check out '),
          {
            type: 'mention',
            platform: 'GH',
            handle: 'innei',
            version: 1,
          } as any,
          textNode(' on GitHub and '),
          {
            type: 'mention',
            platform: 'TW',
            handle: '_oQuery',
            version: 1,
          } as any,
          textNode(' on Twitter.'),
        ),
      ])
      const md = service.lexicalToMarkdown(state)
      expect(md).toContain('{GH@innei}')
      expect(md).toContain('{TW@_oQuery}')
    })

    it('footnote sample: references + definitions', () => {
      const state = makeEditorState([
        paragraph(
          textNode('This is a statement with a footnote'),
          { type: 'footnote', identifier: '1', version: 1 } as any,
          textNode(' and another reference'),
          { type: 'footnote', identifier: '2', version: 1 } as any,
          textNode('.'),
        ),
        {
          type: 'footnote-section',
          definitions: {
            '1': 'First footnote with detailed explanation.',
            '2': 'Second footnote referencing additional sources.',
          },
          version: 1,
        } as any,
      ])
      const md = service.lexicalToMarkdown(state)
      expect(md).toContain('[^1]')
      expect(md).toContain('[^2]')
      expect(md).toContain('[^1]: First footnote with detailed explanation.')
      expect(md).toContain(
        '[^2]: Second footnote referencing additional sources.',
      )
    })

    it('image sample: landscape with thumbhash', () => {
      const state = makeEditorState([
        {
          type: 'image',
          src: 'https://picsum.photos/1200/720?random=301',
          altText: 'Beautiful landscape',
          caption: 'A stunning mountain landscape with loading placeholder',
          width: 1200,
          height: 720,
          thumbhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
          accent: '#7ba8c4',
          version: 1,
        } as any,
      ])
      const md = service.lexicalToMarkdown(state)
      expect(md).toContain(
        '![Beautiful landscape](https://picsum.photos/1200/720?random=301',
      )
      expect(md).toContain('A stunning mountain landscape')
    })

    it('video sample: MDN flower video', () => {
      const state = makeEditorState([
        {
          type: 'video',
          src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
          poster: 'https://picsum.photos/1280/720?random=302',
          width: 1280,
          height: 720,
          version: 1,
        } as any,
      ])
      const md = service.lexicalToMarkdown(state)
      expect(md).toContain(
        'src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"',
      )
      expect(md).toContain('poster=')
      expect(md).toContain('width=1280')
      expect(md).toContain('height=720')
    })

    it('code-block sample: TypeScript multi-line code', () => {
      const code = `type User = {
  id: string
  name: string
  role: 'admin' | 'editor' | 'viewer'
}

async function fetchUsers(): Promise<User[]> {
  const response = await fetch('/api/users')
  return response.json()
}`
      const state = makeEditorState([
        { type: 'code-block', language: 'typescript', code, version: 1 } as any,
      ])
      const md = service.lexicalToMarkdown(state)
      expect(md).toContain('```typescript')
      expect(md).toContain('type User')
      expect(md).toContain('async function fetchUsers')
    })

    it('code-snippet sample: multi-file tabs', () => {
      const state = makeEditorState([
        {
          type: 'code-snippet',
          files: [
            {
              filename: 'index.ts',
              code: `export function hello(name: string): string {\n  return \`Hello, \${name}!\`\n}`,
              language: 'typescript',
            },
            {
              filename: 'test.ts',
              code: `import { hello } from './index'\n\nconsole.log(hello('World'))`,
              language: 'typescript',
            },
          ],
          version: 1,
        } as any,
      ])
      const md = service.lexicalToMarkdown(state)
      expect(md).toContain('::: code-snippet')
      expect(md).toContain('file{name="index.ts" lang="typescript"}')
      expect(md).toContain('file{name="test.ts" lang="typescript"}')
      expect(md).toContain('export function hello')
      expect(md).toContain("hello('World')")
    })

    it('mermaid sample: flowchart', () => {
      const diagram = `graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[OK]
    B -->|No| D[Cancel]
    C --> E[End]
    D --> E`
      const state = makeEditorState([
        { type: 'mermaid', diagram, version: 1 } as any,
      ])
      const md = service.lexicalToMarkdown(state)
      expect(md).toContain('```mermaid')
      expect(md).toContain('graph TD')
      expect(md).toContain('A[Start]')
    })

    it('mermaid sample: sequence diagram', () => {
      const diagram = `sequenceDiagram
    participant Client
    participant Server
    Client->>Server: POST /api/login
    Server-->>Client: JWT token`
      const state = makeEditorState([
        { type: 'mermaid', diagram, version: 1 } as any,
      ])
      const md = service.lexicalToMarkdown(state)
      expect(md).toContain('sequenceDiagram')
      expect(md).toContain('Client->>Server')
    })

    it('katex-block sample: Gaussian integral', () => {
      const state = makeEditorState([
        paragraph({
          type: 'katex-block',
          equation: '\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}',
          version: 1,
        } as any),
      ])
      const md = service.lexicalToMarkdown(state)
      expect(md).toContain(
        '$$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$',
      )
    })

    it('link-card sample: GitHub repo', () => {
      const state = makeEditorState([
        {
          type: 'link-card',
          url: 'https://github.com/Innei/Shiroi',
          title: 'Shiroi - Modern Blog System',
          description: 'A beautiful Next.js-based blog platform',
          favicon: 'https://github.githubassets.com/favicons/favicon.svg',
          image: 'https://opengraph.githubassets.com/1/Innei/Shiroi',
          version: 1,
        } as any,
      ])
      const md = service.lexicalToMarkdown(state)
      expect(md).toContain(
        '[Shiroi - Modern Blog System](https://github.com/Innei/Shiroi)',
      )
    })

    it('table sample: feature matrix', () => {
      const state = makeEditorState([
        {
          type: 'table',
          version: 1,
          children: [
            tableRow(
              tableCell('Feature', 1),
              tableCell('Status', 1),
              tableCell('Notes', 1),
            ),
            tableRow(
              tableCell('Action Menu'),
              tableCell('Done'),
              tableCell('Chevron dropdown on active cell'),
            ),
            tableRow(
              tableCell('Hover Actions'),
              tableCell('Done'),
              tableCell('+ buttons on edges'),
            ),
            tableRow(
              tableCell('Column Resize'),
              tableCell('Done'),
              tableCell('Drag cell borders'),
            ),
          ],
          direction: 'ltr',
          format: '',
          indent: 0,
        } as any,
      ])
      const md = service.lexicalToMarkdown(state)
      expect(md).toContain('| Feature | Status | Notes |')
      expect(md).toContain('| --- | --- | --- |')
      expect(md).toContain(
        '| Action Menu | Done | Chevron dropdown on active cell |',
      )
      expect(md).toContain('| Column Resize | Done | Drag cell borders |')
    })

    it('gallery sample: 4 images grid', () => {
      const state = makeEditorState([
        {
          type: 'gallery',
          layout: 'grid',
          images: [
            {
              src: 'https://picsum.photos/400/300?random=1',
              alt: 'Image 1',
              width: 400,
              height: 300,
            },
            {
              src: 'https://picsum.photos/400/300?random=2',
              alt: 'Image 2',
              width: 400,
              height: 300,
            },
            {
              src: 'https://picsum.photos/400/300?random=3',
              alt: 'Image 3',
              width: 400,
              height: 300,
            },
            {
              src: 'https://picsum.photos/400/300?random=4',
              alt: 'Image 4',
              width: 400,
              height: 300,
            },
          ],
          version: 1,
        } as any,
      ])
      const md = service.lexicalToMarkdown(state)
      expect(md).toContain('![Image 1](https://picsum.photos/400/300?random=1)')
      expect(md).toContain('![Image 4](https://picsum.photos/400/300?random=4)')
    })

    it('excalidraw sample: canvas with shapes', () => {
      const snapshot = JSON.stringify({
        store: {
          'document:document': {
            gridSize: 10,
            name: '',
            meta: {},
            id: 'document:document',
            typeName: 'document',
          },
          'shape:rect1': {
            x: 100,
            y: 100,
            type: 'geo',
            props: { w: 200, h: 120, text: 'Hello Excalidraw' },
          },
        },
        schema: { schemaVersion: 2, sequences: {} },
      })
      const state = makeEditorState([
        { type: 'excalidraw', snapshot, version: 1 } as any,
      ])
      const md = service.lexicalToMarkdown(state)
      expect(md).toContain('<excalidraw>')
      expect(md).toContain('Hello Excalidraw')
      expect(md).toContain('</excalidraw>')
    })

    it('grid-container sample: 2-col with formatted text', () => {
      const state = makeEditorState([
        {
          type: 'grid-container',
          cols: 2,
          gap: '16px',
          cells: [
            {
              root: {
                children: [
                  paragraph(
                    textNode('Left column content with some text', FORMAT_BOLD),
                  ),
                ],
                direction: null,
                format: '',
                indent: 0,
                type: 'root',
                version: 1,
              },
            },
            {
              root: {
                children: [
                  paragraph(
                    textNode('Right column content with '),
                    textNode('italic text', FORMAT_ITALIC),
                  ),
                ],
                direction: null,
                format: '',
                indent: 0,
                type: 'root',
                version: 1,
              },
            },
          ],
          version: 1,
        } as any,
      ])
      const md = service.lexicalToMarkdown(state)
      expect(md).toContain('::: grid{cols=2 gap="16px"}')
      expect(md).toContain('Left column content')
      expect(md).toContain('Right column content')
    })

    it('details sample: collapsible with multi-paragraph', () => {
      const state = makeEditorState([
        {
          type: 'details',
          summary: 'Click to expand',
          open: false,
          children: [
            paragraph(
              textNode('This content is hidden by default and can be toggled.'),
            ),
            paragraph(
              textNode('Perfect for FAQ sections or additional information.'),
            ),
          ],
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1,
        } as any,
      ])
      const md = service.lexicalToMarkdown(state)
      expect(md).toContain('::: details{summary="Click to expand"}')
      expect(md).toContain('hidden by default')
      expect(md).toContain('FAQ sections')
    })

    it('full document: initialContent equivalent', () => {
      const state = makeEditorState([
        heading('h1', textNode('Rich Editor Demo')),

        paragraph(
          textNode('Welcome to the '),
          textNode('@haklex/rich-editor', FORMAT_CODE),
          textNode(' playground. Try '),
          textNode('markdown shortcuts', FORMAT_BOLD),
          textNode(', '),
          textNode('inline formatting', FORMAT_ITALIC),
          textNode(', and custom blocks below.'),
        ),

        heading('h2', textNode('Inline Features')),
        paragraph(
          textNode('Supports '),
          textNode('bold', FORMAT_BOLD),
          textNode(', '),
          textNode('italic', FORMAT_ITALIC),
          textNode(', '),
          textNode('inline code', FORMAT_CODE),
          textNode(', and '),
          {
            type: 'spoiler',
            children: [textNode('hidden spoiler text')],
            version: 1,
            direction: 'ltr',
            format: '',
            indent: 0,
          } as any,
          textNode('. Math: '),
          { type: 'katex-inline', equation: 'E = mc^2', version: 1 } as any,
          textNode('. Mention: '),
          {
            type: 'mention',
            platform: 'GH',
            handle: 'innei',
            version: 1,
          } as any,
          textNode('.'),
        ),

        heading('h2', textNode('Alerts')),
        alertQuote(
          'note',
          paragraph(textNode('This is a note alert for additional context.')),
        ),
        alertQuote(
          'tip',
          paragraph(
            textNode('Pro tip: Use '),
            textNode('pnpm', FORMAT_CODE),
            textNode(' for faster installs.'),
          ),
        ),

        heading('h2', textNode('Code Block')),
        {
          type: 'code-block',
          language: 'typescript',
          code: `function greet(name: string): string {\n  return \`Hello, \${name}!\`\n}\n\nconsole.log(greet('World'))`,
          version: 1,
        } as any,

        heading('h2', textNode('Lists & Tasks')),
        list(
          'bullet',
          listItem(paragraph(textNode('First item'))),
          listItem(paragraph(textNode('Second item'))),
          listItem(paragraph(textNode('Third item'))),
        ),

        heading('h2', textNode('Mermaid Diagram')),
        {
          type: 'mermaid',
          diagram:
            'graph TD\n    A[Start] --> B{Is it working?}\n    B -->|Yes| C[Great!]',
          version: 1,
        } as any,

        heading('h2', textNode('Blockquote & Math')),
        quote(
          paragraph(
            textNode('The best code is no code at all.', FORMAT_ITALIC),
          ),
        ),
        paragraph({
          type: 'katex-block',
          equation: '\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}',
          version: 1,
        } as any),

        hr(),

        heading('h2', textNode('Image')),
        {
          type: 'image',
          src: 'https://picsum.photos/1200/720?random=510',
          altText: 'Sample landscape',
          caption:
            'Enhanced image renderer: thumbhash placeholder + click to zoom',
          width: 1200,
          height: 720,
          version: 1,
        } as any,

        heading('h2', textNode('Video')),
        {
          type: 'video',
          src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
          poster: 'https://picsum.photos/1200/675?random=511',
          width: 1200,
          height: 675,
          version: 1,
        } as any,

        heading('h2', textNode('Collapsible')),
        {
          type: 'details',
          summary: 'Click to expand',
          open: false,
          children: [paragraph(textNode('Hidden content revealed on toggle.'))],
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1,
        } as any,

        heading('h2', textNode('Link Card')),
        {
          type: 'link-card',
          url: 'https://lexical.dev',
          title: 'Lexical - Extensible Text Editor Framework',
          description:
            'An extensible JavaScript web text-editor framework by Meta.',
          favicon: 'https://lexical.dev/favicon.ico',
          version: 1,
        } as any,

        paragraph(
          textNode(
            'Start editing above, or import JSON via the toolbar.',
            FORMAT_ITALIC,
          ),
        ),
      ])

      const md = service.lexicalToMarkdown(state)

      expect(md).toContain('# Rich Editor Demo')
      expect(md).toContain('`@haklex/rich-editor`')
      expect(md).toContain('**markdown shortcuts**')
      expect(md).toContain('*inline formatting*')

      expect(md).toContain('## Inline Features')
      expect(md).toContain('||hidden spoiler text||')
      expect(md).toContain('$E = mc^2$')
      expect(md).toContain('{GH@innei}')

      expect(md).toContain('> [!NOTE]')
      expect(md).toContain('> [!TIP]')
      expect(md).toContain('pnpm')

      expect(md).toContain('```typescript')
      expect(md).toContain('function greet')

      expect(md).toContain('- First item')
      expect(md).toContain('- Second item')

      expect(md).toContain('```mermaid')
      expect(md).toContain('graph TD')

      expect(md).toContain('> *The best code is no code at all.*')
      expect(md).toContain('$$\\int_{-\\infty}^{\\infty}')

      expect(md).toContain('---')

      expect(md).toContain(
        '![Sample landscape](https://picsum.photos/1200/720?random=510',
      )
      expect(md).toContain(
        '<video src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"',
      )

      expect(md).toContain('::: details{summary="Click to expand"}')
      expect(md).toContain(
        '[Lexical - Extensible Text Editor Framework](https://lexical.dev)',
      )
      expect(md).toContain('*Start editing above')
    })

    it('full document: banner + alert-quote + embed + gallery mixed', () => {
      const state = makeEditorState([
        heading('h2', textNode('Container 容器语法')),

        banner(
          'info',
          paragraph(
            textNode('这是一条信息提示，使用 '),
            textNode('info', FORMAT_CODE),
            textNode(' 类型。'),
          ),
        ),
        banner('success', paragraph(textNode('操作成功！'))),
        banner('warning', paragraph(textNode('请注意！'))),
        banner('error', paragraph(textNode('出错了！'))),

        heading('h2', textNode('Alerts')),
        alertQuote('note', paragraph(textNode('提示信息'))),
        alertQuote('tip', paragraph(textNode('小技巧'))),
        alertQuote('important', paragraph(textNode('重要信息'))),
        alertQuote('warning', paragraph(textNode('警告信息'))),
        alertQuote('caution', paragraph(textNode('危险提示'))),

        heading('h2', textNode('Embeds')),
        {
          type: 'embed',
          url: 'https://twitter.com/zhizijun/status/1649822091234148352',
          source: 'tweet',
          version: 1,
        } as any,
        {
          type: 'embed',
          url: 'https://www.youtube.com/watch?v=N93cTbtLCIM',
          source: 'youtube',
          version: 1,
        } as any,

        heading('h2', textNode('Gallery')),
        {
          type: 'gallery',
          layout: 'grid',
          images: [
            { src: 'https://example.com/1.jpg', width: 1200, height: 800 },
            { src: 'https://example.com/2.jpg', width: 1200, height: 800 },
            { src: 'https://example.com/3.jpg', width: 1200, height: 800 },
          ],
          version: 1,
        } as any,

        hr(),
        paragraph(textNode('最后更新：2026-01-11', FORMAT_ITALIC)),
      ])

      const md = service.lexicalToMarkdown(state)

      expect(md).toContain('## Container 容器语法')
      expect(md).toContain('::: info')
      expect(md).toContain('::: success')
      expect(md).toContain('::: warning')
      expect(md).toContain('::: error')

      expect(md).toContain('> [!NOTE]')
      expect(md).toContain('> [!TIP]')
      expect(md).toContain('> [!IMPORTANT]')
      expect(md).toContain('> [!WARNING]')
      expect(md).toContain('> [!CAUTION]')

      expect(md).toContain(
        '<https://twitter.com/zhizijun/status/1649822091234148352>',
      )
      expect(md).toContain('<https://www.youtube.com/watch?v=N93cTbtLCIM>')

      expect(md).toContain('![](https://example.com/1.jpg)')
      expect(md).toContain('![](https://example.com/3.jpg)')

      expect(md).toContain('---')
      expect(md).toContain('*最后更新：2026-01-11*')
    })

    it('full document: math-heavy content', () => {
      const state = makeEditorState([
        heading('h2', textNode('数学公式 (KaTeX)')),

        heading('h3', textNode('行内公式')),
        paragraph(
          textNode('爱因斯坦质能方程 '),
          { type: 'katex-inline', equation: 'E = mc^2', version: 1 } as any,
          textNode(' 是物理学中最著名的公式。'),
        ),
        paragraph(
          textNode('勾股定理表示为 '),
          {
            type: 'katex-inline',
            equation: 'c = \\pm\\sqrt{a^2 + b^2}',
            version: 1,
          } as any,
          textNode(' 。'),
        ),
        paragraph(
          textNode('二次方程求根公式是 '),
          {
            type: 'katex-inline',
            equation: 'x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}',
            version: 1,
          } as any,
          textNode(' 。'),
        ),

        heading('h3', textNode('块级公式')),
        paragraph({
          type: 'katex-block',
          equation: '\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}',
          version: 1,
        } as any),
        paragraph({
          type: 'katex-block',
          equation: 'P(x) = a_nx^n + a_{n-1}x^{n-1} + \\dots + a_1x + a_0',
          version: 1,
        } as any),
        paragraph({
          type: 'katex-block',
          equation: '\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}',
          version: 1,
        } as any),
      ])

      const md = service.lexicalToMarkdown(state)

      expect(md).toContain('## 数学公式 (KaTeX)')
      expect(md).toContain('$E = mc^2$')
      expect(md).toContain('$c = \\pm\\sqrt{a^2 + b^2}$')
      expect(md).toContain('$x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$')
      expect(md).toContain('$$\\int_{-\\infty}^{\\infty}')
      expect(md).toContain('$$P(x) = a_nx^n')
      expect(md).toContain('$$\\sum_{i=1}^{n}')
    })

    it('full document: mention + link + footnote comprehensive', () => {
      const state = makeEditorState([
        heading('h2', textNode('@ 提及')),
        paragraph({
          type: 'mention',
          platform: 'GH',
          handle: 'Innei',
          displayName: 'Innei',
          version: 1,
        } as any),
        paragraph({
          type: 'mention',
          platform: 'TG',
          handle: '52Lxcloud',
          displayName: '52Lxcloud',
          version: 1,
        } as any),

        heading('h2', textNode('链接')),
        paragraph(link('https://github.com', textNode('访问 GitHub'))),
        paragraph(
          link('https://github.com/Innei/Shiro', textNode('Shiroi 项目')),
        ),

        heading('h2', textNode('脚注')),
        paragraph(
          textNode('这是一段带有脚注的文本'),
          { type: 'footnote', identifier: '1', version: 1 } as any,
          textNode('，还有另一个脚注'),
          { type: 'footnote', identifier: '2', version: 1 } as any,
          textNode('。'),
        ),
        {
          type: 'footnote-section',
          definitions: {
            '1': '这是第一个脚注的内容，包含一些详细说明。',
            '2': '第二个脚注引用了相关资料和参考链接。',
          },
          version: 1,
        } as any,
      ])

      const md = service.lexicalToMarkdown(state)

      expect(md).toContain('[Innei]{GH@Innei}')
      expect(md).toContain('[52Lxcloud]{TG@52Lxcloud}')
      expect(md).toContain('[访问 GitHub](https://github.com)')
      expect(md).toContain('[Shiroi 项目](https://github.com/Innei/Shiro)')
      expect(md).toContain('[^1]')
      expect(md).toContain('[^2]')
      expect(md).toContain('[^1]: 这是第一个脚注的内容')
      expect(md).toContain('[^2]: 第二个脚注引用了相关资料')
    })
  })
})
