import {
  extractDocumentContext,
  parseLexicalForTranslation,
  restoreLexicalTranslation,
} from '~/modules/ai/ai-translation/lexical-translation-parser'
import { describe, expect, it } from 'vitest'

const makeEditorState = (children: any[]) =>
  JSON.stringify({ root: { children, type: 'root', direction: 'ltr' } })

const textNode = (text: string, format = 0) => ({
  type: 'text',
  text,
  format,
  detail: 0,
  mode: 'normal',
  style: '',
})

const paragraph = (...children: any[]) => ({
  type: 'paragraph',
  children,
  direction: 'ltr',
  format: '',
  indent: 0,
})

const heading = (tag: string, ...children: any[]) => ({
  type: 'heading',
  tag,
  children,
  direction: 'ltr',
  format: '',
  indent: 0,
})

const codeBlock = (code: string, lang = '') => ({
  type: 'code',
  language: lang,
  children: [{ type: 'code-highlight', text: code, format: 0 }],
  direction: 'ltr',
  format: '',
  indent: 0,
})

const quoteNode = (...children: any[]) => ({
  type: 'quote',
  children,
  direction: 'ltr',
  format: '',
  indent: 0,
})

const listNode = (
  listType: string,
  ...items: Array<{ children: any[]; value?: number }>
) => ({
  type: 'list',
  listType,
  children: items.map((item, i) => ({
    type: 'listitem',
    children: item.children,
    value: item.value ?? i + 1,
    direction: 'ltr',
    format: '',
    indent: 0,
  })),
  direction: 'ltr',
  format: '',
  indent: 0,
  start: 1,
  tag: listType === 'number' ? 'ol' : 'ul',
})

const linkNode = (url: string, ...children: any[]) => ({
  type: 'link',
  url,
  children,
  direction: 'ltr',
  format: '',
  indent: 0,
  rel: 'noopener',
  target: null,
})

const alertQuoteNode = (alertType: string, ...children: any[]) => ({
  type: 'alert-quote',
  alertType,
  content: {
    root: { children, type: 'root', direction: 'ltr' },
  },
  version: 1,
})

const bannerNode = (bannerType: string, ...children: any[]) => ({
  type: 'banner',
  bannerType,
  content: {
    root: { children, type: 'root', direction: 'ltr' },
  },
  version: 1,
})

const imageNode = (src = 'https://example.com/img.jpg') => ({
  type: 'image',
  src,
  altText: '',
  version: 1,
})

const videoNode = (src = 'https://example.com/vid.mp4') => ({
  type: 'video',
  src,
  version: 1,
})

const mermaidNode = (diagram = 'graph LR; A-->B') => ({
  type: 'mermaid',
  diagram,
  version: 1,
})

const katexBlockNode = (equation = 'E=mc^2') => ({
  type: 'katex-block',
  equation,
  version: 1,
})

const hrNode = () => ({ type: 'horizontalrule', version: 1 })

const tableNode = (...rows: any[]) => ({
  type: 'table',
  children: rows,
  direction: 'ltr',
  format: '',
  indent: 0,
})

const tableRowNode = (...cells: any[]) => ({
  type: 'tablerow',
  children: cells,
  direction: 'ltr',
  format: '',
  indent: 0,
})

const tableCellNode = (...children: any[]) => ({
  type: 'tablecell',
  children,
  headerState: 0,
  direction: 'ltr',
  format: '',
  indent: 0,
})

const detailsNode = (summary: string, ...children: any[]) => ({
  type: 'details',
  summary,
  open: false,
  children,
  direction: 'ltr',
  format: '',
  indent: 0,
})

const footnoteSection = (definitions: Record<string, string>) => ({
  type: 'footnote-section',
  definitions,
  version: 1,
})

const rubyNode = (base: string, reading: string) => ({
  type: 'ruby',
  reading,
  children: [textNode(base)],
  direction: 'ltr',
  format: '',
  indent: 0,
})

const FORMAT_BOLD = 1
const FORMAT_ITALIC = 2
const FORMAT_CODE = 16

describe('lexical-translation-parser', () => {
  describe('parseLexicalForTranslation', () => {
    it('simple paragraph → segments with text', () => {
      const json = makeEditorState([paragraph(textNode('Hello world'))])
      const { segments, propertySegments } = parseLexicalForTranslation(json)

      expect(segments).toHaveLength(1)
      expect(segments[0].id).toBe('t_0')
      expect(segments[0].text).toBe('Hello world')
      expect(segments[0].translatable).toBe(true)
      expect(propertySegments).toHaveLength(0)
    })

    it('heading + paragraphs → multiple segments', () => {
      const json = makeEditorState([
        heading('h2', textNode('Title')),
        paragraph(textNode('First paragraph')),
        paragraph(textNode('Second paragraph')),
      ])
      const { segments } = parseLexicalForTranslation(json)

      expect(segments).toHaveLength(3)
      expect(segments[0].text).toBe('Title')
      expect(segments[1].text).toBe('First paragraph')
      expect(segments[2].text).toBe('Second paragraph')
    })

    it('code block skips entire subtree', () => {
      const json = makeEditorState([
        paragraph(textNode('Before code')),
        codeBlock('const x = 1', 'typescript'),
        paragraph(textNode('After code')),
      ])
      const { segments } = parseLexicalForTranslation(json)

      expect(segments).toHaveLength(2)
      expect(segments[0].text).toBe('Before code')
      expect(segments[1].text).toBe('After code')
    })

    it('all skip-blocks → 0 segments', () => {
      const json = makeEditorState([
        codeBlock('const a = 1'),
        hrNode(),
        codeBlock('const b = 2'),
        imageNode(),
        videoNode(),
        mermaidNode(),
        katexBlockNode(),
      ])
      const { segments, propertySegments } = parseLexicalForTranslation(json)

      expect(segments).toHaveLength(0)
      expect(propertySegments).toHaveLength(0)
    })

    it('nested list with formatted text → all text collected', () => {
      const json = makeEditorState([
        listNode(
          'bullet',
          { children: [textNode('Item one', FORMAT_BOLD)] },
          {
            children: [
              textNode('Item two'),
              listNode('bullet', {
                children: [textNode('Nested item', FORMAT_ITALIC)],
              }),
            ],
          },
        ),
      ])
      const { segments } = parseLexicalForTranslation(json)

      expect(segments).toHaveLength(3)
      expect(segments[0].text).toBe('Item one')
      expect(segments[1].text).toBe('Item two')
      expect(segments[2].text).toBe('Nested item')
    })

    it('nested editor content (alert-quote, banner) collected via generic scan', () => {
      const json = makeEditorState([
        paragraph(textNode('Before')),
        alertQuoteNode('note', paragraph(textNode('Alert text'))),
        bannerNode('tip', paragraph(textNode('Banner text'))),
        paragraph(textNode('After')),
      ])
      const { segments } = parseLexicalForTranslation(json)

      const texts = segments.map((s) => s.text)
      expect(texts).toEqual(['Before', 'Alert text', 'Banner text', 'After'])
    })

    it('empty text nodes are skipped', () => {
      const json = makeEditorState([
        paragraph(textNode(''), textNode('  '), textNode('Real text')),
      ])
      const { segments } = parseLexicalForTranslation(json)

      expect(segments).toHaveLength(1)
      expect(segments[0].text).toBe('Real text')
    })

    it('inline code → translatable: false', () => {
      const json = makeEditorState([
        paragraph(textNode('normal text'), textNode('code text', FORMAT_CODE)),
      ])
      const { segments } = parseLexicalForTranslation(json)

      expect(segments).toHaveLength(2)
      expect(segments[0].translatable).toBe(true)
      expect(segments[1].translatable).toBe(false)
    })

    it('skip-inline nodes (katex-inline, mention, footnote) → not collected', () => {
      const json = makeEditorState([
        paragraph(
          textNode('Before'),
          { type: 'katex-inline', equation: 'x^2', version: 1 },
          textNode('Middle'),
          { type: 'mention', value: '@user', version: 1 },
          textNode('After'),
          { type: 'footnote', id: '1', version: 1 },
        ),
      ])
      const { segments } = parseLexicalForTranslation(json)

      expect(segments).toHaveLength(3)
      expect(segments.map((s) => s.text)).toEqual(['Before', 'Middle', 'After'])
    })

    it('link inner text → collected', () => {
      const json = makeEditorState([
        paragraph(linkNode('https://example.com', textNode('Click here'))),
      ])
      const { segments } = parseLexicalForTranslation(json)

      expect(segments).toHaveLength(1)
      expect(segments[0].text).toBe('Click here')
    })

    it('spoiler inner text → collected', () => {
      const json = makeEditorState([
        paragraph({
          type: 'spoiler',
          children: [textNode('Hidden text')],
        }),
      ])
      const { segments } = parseLexicalForTranslation(json)

      expect(segments).toHaveLength(1)
      expect(segments[0].text).toBe('Hidden text')
    })

    it('ruby node base text + reading property → both collected', () => {
      const json = makeEditorState([paragraph(rubyNode('漢字', 'かんじ'))])
      const { segments, propertySegments } = parseLexicalForTranslation(json)

      expect(segments).toHaveLength(1)
      expect(segments[0].text).toBe('漢字')
      expect(segments[0].translatable).toBe(true)

      expect(propertySegments).toHaveLength(1)
      expect(propertySegments[0].property).toBe('reading')
      expect(propertySegments[0].text).toBe('かんじ')
    })

    it('details.summary → PropertySegment', () => {
      const json = makeEditorState([
        detailsNode('Click to expand', paragraph(textNode('Details body'))),
      ])
      const { segments, propertySegments } = parseLexicalForTranslation(json)

      expect(segments).toHaveLength(1)
      expect(segments[0].text).toBe('Details body')

      expect(propertySegments).toHaveLength(1)
      expect(propertySegments[0].id).toBe('p_0')
      expect(propertySegments[0].text).toBe('Click to expand')
      expect(propertySegments[0].property).toBe('summary')
      expect(propertySegments[0].key).toBeUndefined()
    })

    it('footnote-section.definitions → PropertySegments for each value', () => {
      const json = makeEditorState([
        footnoteSection({
          '1': 'First footnote text',
          '2': 'Second footnote text',
          '3': '',
        }),
      ])
      const { segments, propertySegments } = parseLexicalForTranslation(json)

      expect(segments).toHaveLength(0)
      expect(propertySegments).toHaveLength(2)
      expect(propertySegments[0].text).toBe('First footnote text')
      expect(propertySegments[0].property).toBe('definitions')
      expect(propertySegments[0].key).toBe('1')
      expect(propertySegments[1].text).toBe('Second footnote text')
      expect(propertySegments[1].key).toBe('2')
    })

    it('all IDs unique across document', () => {
      const json = makeEditorState([
        heading('h1', textNode('Title')),
        paragraph(textNode('Paragraph one')),
        detailsNode('Summary', paragraph(textNode('Details body'))),
        alertQuoteNode('note', paragraph(textNode('Alert text'))),
        footnoteSection({ '1': 'Footnote one' }),
      ])
      const { segments, propertySegments } = parseLexicalForTranslation(json)

      const allIds = [
        ...segments.map((s) => s.id),
        ...propertySegments.map((p) => p.id),
      ]
      expect(new Set(allIds).size).toBe(allIds.length)
    })

    it('grid-container cells detected via generic nested scan', () => {
      const gridContainer = {
        type: 'grid-container',
        cells: [
          {
            root: {
              children: [paragraph(textNode('Cell A'))],
              type: 'root',
              direction: 'ltr',
            },
          },
          {
            root: {
              children: [paragraph(textNode('Cell B'))],
              type: 'root',
              direction: 'ltr',
            },
          },
        ],
        version: 1,
      }
      const json = makeEditorState([gridContainer])
      const { segments } = parseLexicalForTranslation(json)

      expect(segments).toHaveLength(2)
      expect(segments[0].text).toBe('Cell A')
      expect(segments[1].text).toBe('Cell B')
    })

    it('ignores lexical node state key "$" (blockId metadata)', () => {
      const json = makeEditorState([
        {
          ...paragraph(textNode('With block id')),
          $: { blockId: 'abc123' },
        },
      ])
      const { segments } = parseLexicalForTranslation(json)

      expect(segments).toHaveLength(1)
      expect(segments[0].text).toBe('With block id')
    })
  })

  describe('restoreLexicalTranslation', () => {
    it('apply translations to segments', () => {
      const json = makeEditorState([
        paragraph(textNode('Hello')),
        paragraph(textNode('World')),
      ])
      const result = parseLexicalForTranslation(json)

      const translations = new Map<string, string>([
        ['t_0', '你好'],
        ['t_1', '世界'],
      ])

      const restored = restoreLexicalTranslation(result, translations)
      const parsed = JSON.parse(restored)

      expect(parsed.root.children[0].children[0].text).toBe('你好')
      expect(parsed.root.children[1].children[0].text).toBe('世界')
    })

    it('apply translations to PropertySegments (summary)', () => {
      const json = makeEditorState([
        detailsNode('Click to expand', paragraph(textNode('Body'))),
      ])
      const result = parseLexicalForTranslation(json)

      const translations = new Map<string, string>([
        ['t_0', '正文'],
        ['p_0', '点击展开'],
      ])

      const restored = restoreLexicalTranslation(result, translations)
      const parsed = JSON.parse(restored)

      expect(parsed.root.children[0].summary).toBe('点击展开')
      expect(parsed.root.children[0].children[0].children[0].text).toBe('正文')
    })

    it('apply translations to ruby reading property', () => {
      const json = makeEditorState([paragraph(rubyNode('漢字', 'かんじ'))])
      const result = parseLexicalForTranslation(json)

      const rubyText = result.segments.find((seg) => seg.text === '漢字')
      const rubyReading = result.propertySegments.find(
        (seg) => seg.property === 'reading',
      )

      expect(rubyText).toBeDefined()
      expect(rubyReading).toBeDefined()

      const translations = new Map<string, string>([
        [rubyText!.id, '漢字'],
        [rubyReading!.id, 'かんじ（注音）'],
      ])

      const restored = restoreLexicalTranslation(result, translations)
      const parsed = JSON.parse(restored)

      expect(parsed.root.children[0].children[0].reading).toBe('かんじ（注音）')
      expect(parsed.root.children[0].children[0].children[0].text).toBe('漢字')
    })

    it('apply translations to PropertySegments with key (definitions)', () => {
      const json = makeEditorState([
        footnoteSection({ '1': 'Note A', '2': 'Note B' }),
      ])
      const result = parseLexicalForTranslation(json)

      const translations = new Map<string, string>([
        ['p_0', '注释 A'],
        ['p_1', '注释 B'],
      ])

      const restored = restoreLexicalTranslation(result, translations)
      const parsed = JSON.parse(restored)

      expect(parsed.root.children[0].definitions['1']).toBe('注释 A')
      expect(parsed.root.children[0].definitions['2']).toBe('注释 B')
    })

    it('restore nested editor content', () => {
      const json = makeEditorState([
        alertQuoteNode('note', paragraph(textNode('Alert text'))),
      ])
      const result = parseLexicalForTranslation(json)

      const translations = new Map<string, string>([['t_0', '警告文本']])
      const restored = restoreLexicalTranslation(result, translations)
      const parsed = JSON.parse(restored)

      expect(
        parsed.root.children[0].content.root.children[0].children[0].text,
      ).toBe('警告文本')
    })

    it('missing translation falls back to original', () => {
      const json = makeEditorState([paragraph(textNode('Keep me'))])
      const result = parseLexicalForTranslation(json)

      const translations = new Map<string, string>()
      const restored = restoreLexicalTranslation(result, translations)
      const parsed = JSON.parse(restored)

      expect(parsed.root.children[0].children[0].text).toBe('Keep me')
    })

    it('non-translatable segments (inline code) are not modified', () => {
      const json = makeEditorState([
        paragraph(textNode('normal'), textNode('code', FORMAT_CODE)),
      ])
      const result = parseLexicalForTranslation(json)

      const translations = new Map<string, string>([
        ['t_0', '普通'],
        ['t_1', '代码'],
      ])
      const restored = restoreLexicalTranslation(result, translations)
      const parsed = JSON.parse(restored)

      expect(parsed.root.children[0].children[0].text).toBe('普通')
      expect(parsed.root.children[0].children[1].text).toBe('code')
    })
  })

  describe('extractDocumentContext', () => {
    it('headings and paragraphs → separated by \\n\\n', () => {
      const json = makeEditorState([
        heading('h1', textNode('Title')),
        paragraph(textNode('Body text')),
      ])
      const { editorState } = parseLexicalForTranslation(json)
      const context = extractDocumentContext(editorState.root.children)

      expect(context).toBe('Title\n\nBody text')
    })

    it('skip-blocks excluded from context', () => {
      const json = makeEditorState([
        paragraph(textNode('Before')),
        codeBlock('const x = 1'),
        imageNode(),
        paragraph(textNode('After')),
      ])
      const { editorState } = parseLexicalForTranslation(json)
      const context = extractDocumentContext(editorState.root.children)

      expect(context).toBe('Before\n\nAfter')
    })

    it('nested editor content included', () => {
      const json = makeEditorState([
        bannerNode('tip', paragraph(textNode('Banner text'))),
        paragraph(textNode('Body')),
      ])
      const { editorState } = parseLexicalForTranslation(json)
      const context = extractDocumentContext(editorState.root.children)

      expect(context).toContain('Banner text')
      expect(context).toContain('Body')
    })

    it('inline nodes joined without separator', () => {
      const json = makeEditorState([
        paragraph(
          textNode('Hello '),
          textNode('world', FORMAT_BOLD),
          textNode('!'),
        ),
      ])
      const { editorState } = parseLexicalForTranslation(json)
      const context = extractDocumentContext(editorState.root.children)

      expect(context).toBe('Hello world!')
    })

    it('list items separated by \\n', () => {
      const json = makeEditorState([
        listNode(
          'bullet',
          { children: [textNode('Item one')] },
          { children: [textNode('Item two')] },
        ),
      ])
      const { editorState } = parseLexicalForTranslation(json)
      const context = extractDocumentContext(editorState.root.children)

      expect(context).toBe('Item one\nItem two')
    })
  })

  // ── Complex document tests ──

  describe('complex documents', () => {
    it('blog post: all text collected, skip-blocks excluded', () => {
      const json = makeEditorState([
        heading('h1', textNode('Building Rich Editors')),
        paragraph(textNode('Lexical is a modern editor framework.')),
        alertQuoteNode('note', paragraph(textNode('Based on Lexical v0.39.'))),
        heading('h2', textNode('Why Lexical')),
        paragraph(
          textNode('Alternatives: '),
          textNode('ProseMirror', FORMAT_CODE),
          textNode(' and '),
          textNode('Slate', FORMAT_CODE),
          textNode('.'),
        ),
        codeBlock('const editor = createEditor()', 'typescript'),
        paragraph(textNode('After the code block.')),
        heading('h2', textNode('Summary')),
        paragraph(textNode('Lexical is worth trying.')),
      ])

      const { segments } = parseLexicalForTranslation(json)
      const texts = segments.map((n) => n.text)

      expect(texts).toContain('Building Rich Editors')
      expect(texts).toContain('Lexical is a modern editor framework.')
      expect(texts).toContain('Based on Lexical v0.39.')
      expect(texts).toContain('Why Lexical')
      expect(texts).toContain('ProseMirror')
      expect(texts).toContain('Slate')
      expect(texts).toContain('After the code block.')
      expect(texts).toContain('Summary')
      expect(texts).toContain('Lexical is worth trying.')
      // code-highlight child of code block NOT collected
      expect(texts).not.toContain('const editor = createEditor()')
    })

    it('tech doc: katexBlock and mermaid skipped, rest collected', () => {
      const json = makeEditorState([
        heading('h1', textNode('ML Quick Reference')),
        bannerNode('tip', paragraph(textNode('Last updated Dec 2025.'))),
        paragraph(
          textNode('Linear regression finds optimal '),
          textNode('θ', FORMAT_ITALIC),
        ),
        katexBlockNode('J(\\theta) = ...'),
        paragraph(textNode('Where the hypothesis is hθ(x).')),
        mermaidNode('graph TD; A-->B; B-->C'),
        paragraph(textNode('Activation functions:')),
        listNode(
          'bullet',
          { children: [textNode('Sigmoid')] },
          { children: [textNode('ReLU')] },
          { children: [textNode('GELU')] },
        ),
      ])

      const { segments } = parseLexicalForTranslation(json)
      const texts = segments.map((n) => n.text)

      expect(texts).toContain('ML Quick Reference')
      expect(texts).toContain('Last updated Dec 2025.')
      expect(texts).toContain('Linear regression finds optimal ')
      expect(texts).toContain('θ')
      expect(texts).toContain('Where the hypothesis is hθ(x).')
      expect(texts).toContain('Activation functions:')
      expect(texts).toContain('Sigmoid')
      expect(texts).toContain('ReLU')
      expect(texts).toContain('GELU')
    })

    it('movie review: media skipped, details and table collected', () => {
      const json = makeEditorState([
        heading('h1', textNode('Film Review')),
        bannerNode('note', paragraph(textNode('Published in Film Column'))),
        paragraph(textNode('A masterpiece of cinema.')),
        imageNode(),
        heading('h2', textNode('Narrative Structure')),
        paragraph(textNode('Non-linear storytelling.')),
        mermaidNode('graph LR; A-->B'),
        heading('h2', textNode('Cast')),
        listNode('bullet', {
          children: [
            textNode('Actor A'),
            textNode(' — lead role', FORMAT_BOLD),
          ],
        }),
        alertQuoteNode(
          'warning',
          paragraph(textNode('Spoiler warning below.')),
        ),
        detailsNode('Spoilers', paragraph(textNode('Hidden spoiler content.'))),
        tableNode(
          tableRowNode(tableCellNode(paragraph(textNode('Category')))),
          tableRowNode(tableCellNode(paragraph(textNode('Rating')))),
        ),
        hrNode(),
        paragraph(textNode('Final score: 5/5')),
      ])

      const { segments, propertySegments } = parseLexicalForTranslation(json)
      const texts = segments.map((n) => n.text)

      expect(texts).toContain('Film Review')
      expect(texts).toContain('Published in Film Column')
      expect(texts).toContain('A masterpiece of cinema.')
      expect(texts).toContain('Narrative Structure')
      expect(texts).toContain('Non-linear storytelling.')
      expect(texts).toContain('Cast')
      expect(texts).toContain('Actor A')
      expect(texts).toContain(' — lead role')
      expect(texts).toContain('Spoiler warning below.')
      expect(texts).toContain('Hidden spoiler content.')
      expect(texts).toContain('Category')
      expect(texts).toContain('Rating')
      expect(texts).toContain('Final score: 5/5')

      // details.summary collected
      expect(propertySegments).toHaveLength(1)
      expect(propertySegments[0].text).toBe('Spoilers')
    })

    it('consecutive skip-blocks produce no segments', () => {
      const json = makeEditorState([
        paragraph(textNode('Before')),
        codeBlock('x=1'),
        imageNode(),
        videoNode(),
        mermaidNode(),
        paragraph(textNode('After')),
      ])

      const { segments } = parseLexicalForTranslation(json)
      expect(segments).toHaveLength(2)
      expect(segments[0].text).toBe('Before')
      expect(segments[1].text).toBe('After')
    })

    it('all text node IDs are globally unique', () => {
      const json = makeEditorState([
        heading('h1', textNode('Title')),
        paragraph(textNode('Paragraph one')),
        codeBlock('code here'),
        paragraph(textNode('Paragraph two')),
        imageNode(),
        heading('h2', textNode('Section')),
        paragraph(textNode('Paragraph three')),
        mermaidNode(),
        listNode(
          'bullet',
          { children: [textNode('Item 1')] },
          { children: [textNode('Item 2')] },
        ),
        detailsNode('Summary', paragraph(textNode('Body'))),
      ])

      const { segments, propertySegments } = parseLexicalForTranslation(json)
      const allIds = [
        ...segments.map((s) => s.id),
        ...propertySegments.map((p) => p.id),
      ]
      expect(new Set(allIds).size).toBe(allIds.length)
      // Text IDs are sequential
      const tIds = segments.map((s) => s.id)
      expect(tIds[0]).toBe('t_0')
      expect(tIds.at(-1)).toBe(`t_${tIds.length - 1}`)
    })

    it('restore: translations applied across entire document', () => {
      const json = makeEditorState([
        heading('h1', textNode('Title')),
        alertQuoteNode('note', paragraph(textNode('Alert text'))),
        paragraph(textNode('Body text')),
        imageNode(),
        paragraph(textNode('After image')),
        detailsNode('Expand', paragraph(textNode('Hidden'))),
      ])

      const result = parseLexicalForTranslation(json)
      const translations = new Map<string, string>()
      for (const seg of result.segments) {
        translations.set(seg.id, `[TR]${seg.text}`)
      }
      for (const prop of result.propertySegments) {
        translations.set(prop.id, `[TR]${prop.text}`)
      }

      const restored = JSON.parse(
        restoreLexicalTranslation(result, translations),
      )

      expect(restored.root.children[0].children[0].text).toBe('[TR]Title')
      expect(
        restored.root.children[1].content.root.children[0].children[0].text,
      ).toBe('[TR]Alert text')
      expect(restored.root.children[2].children[0].text).toBe('[TR]Body text')
      expect(restored.root.children[3].type).toBe('image')
      expect(restored.root.children[4].children[0].text).toBe('[TR]After image')
      expect(restored.root.children[5].summary).toBe('[TR]Expand')
      expect(restored.root.children[5].children[0].children[0].text).toBe(
        '[TR]Hidden',
      )
    })

    it('banner and alertQuote text both collected', () => {
      const json = makeEditorState([
        bannerNode('tip', paragraph(textNode('Banner text'))),
        heading('h1', textNode('Title')),
        alertQuoteNode('warning', paragraph(textNode('Alert text'))),
        paragraph(textNode('Body')),
      ])

      const { segments } = parseLexicalForTranslation(json)
      const texts = segments.map((n) => n.text)
      expect(texts).toEqual(['Banner text', 'Title', 'Alert text', 'Body'])
    })

    it('integration: full blog post parse + context + restore', () => {
      const json = makeEditorState([
        heading('h1', textNode('Modern Rich Text Editors')),
        paragraph(
          textNode('Lexical is '),
          textNode('lightweight and extensible', FORMAT_ITALIC),
          textNode('. This covers core concepts.'),
        ),
        alertQuoteNode('note', paragraph(textNode('Based on Lexical v0.39.'))),
        heading('h2', textNode('Why Lexical')),
        paragraph(
          textNode('Alternatives: '),
          textNode('ProseMirror', FORMAT_CODE),
          textNode(', '),
          textNode('Slate', FORMAT_CODE),
          textNode('. Its '),
          textNode('node system', FORMAT_BOLD),
          textNode(' provides type safety.'),
        ),
        listNode(
          'bullet',
          { children: [textNode('Lightweight (~22KB)')] },
          { children: [textNode('Collaboration support')] },
          { children: [textNode('Accessibility')] },
        ),
        heading('h2', textNode('Architecture')),
        paragraph(textNode('Three layers:')),
        listNode(
          'number',
          { children: [textNode('Core'), textNode(' — state tree')] },
          { children: [textNode('Nodes'), textNode(' — data structures')] },
          {
            children: [textNode('Plugins'), textNode(' — functionality')],
          },
        ),
        quoteNode(textNode('Lexical is framework-agnostic.', FORMAT_ITALIC)),
        heading('h2', textNode('Code Block Node')),
        paragraph(
          textNode('Create a '),
          textNode('DecoratorNode', FORMAT_CODE),
          textNode(' subclass:'),
        ),
        codeBlock('class CodeBlockNode extends DecoratorNode {}', 'ts'),
        paragraph(
          textNode('Note: '),
          textNode('clone()', FORMAT_CODE),
          textNode(' and '),
          textNode('exportJSON()', FORMAT_CODE),
          textNode(' are required.'),
        ),
        heading('h2', textNode('Summary')),
        paragraph(textNode('Lexical excels in performance and DX.')),
        listNode('bullet', {
          children: [
            linkNode('https://lexical.dev', textNode('Official Docs')),
          ],
        }),
      ])

      const result = parseLexicalForTranslation(json)
      const { segments, editorState } = result

      const totalTexts = segments.length
      expect(totalTexts).toBeGreaterThan(25)

      // All IDs unique
      const allIds = segments.map((s) => s.id)
      expect(new Set(allIds).size).toBe(allIds.length)

      // Inline code marked non-translatable
      const codeSegs = segments.filter((s) => !s.translatable)
      expect(codeSegs.length).toBeGreaterThan(0)
      expect(codeSegs.map((s) => s.text)).toContain('ProseMirror')

      // Context extraction
      const context = extractDocumentContext(editorState.root.children)
      expect(context).toContain('Modern Rich Text Editors')
      expect(context).toContain('Based on Lexical v0.39.')
      expect(context).toContain('Lightweight (~22KB)')
      expect(context).not.toContain('class CodeBlockNode')

      // Restore
      const translations = new Map<string, string>()
      for (const seg of segments) {
        if (seg.translatable) {
          translations.set(seg.id, `[ZH]${seg.text}`)
        }
      }

      const restored = JSON.parse(
        restoreLexicalTranslation(result, translations),
      )

      expect(restored.root.children[0].children[0].text).toBe(
        '[ZH]Modern Rich Text Editors',
      )
      expect(
        restored.root.children[2].content.root.children[0].children[0].text,
      ).toBe('[ZH]Based on Lexical v0.39.')

      // Code block unchanged
      const cb = restored.root.children.find((n: any) => n.type === 'code')
      expect(cb.children[0].text).toContain('class CodeBlockNode')

      // Inline code unchanged (non-translatable)
      const codeBlockNodePara = restored.root.children[11]
      const decoratorNode = codeBlockNodePara.children.find(
        (c: any) => c.text === 'DecoratorNode',
      )
      expect(decoratorNode.text).toBe('DecoratorNode')
    })
  })
})
