import {
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

describe('lexical-translation-parser', () => {
  describe('parseLexicalForTranslation', () => {
    it('simple paragraph → 1 chunk, 1 text node', () => {
      const json = makeEditorState([paragraph(textNode('Hello world'))])
      const { chunks } = parseLexicalForTranslation(json)

      expect(chunks).toHaveLength(1)
      expect(chunks[0].textNodes).toHaveLength(1)
      expect(chunks[0].textNodes[0].id).toBe('t_0')
      expect(chunks[0].textNodes[0].originalText).toBe('Hello world')
    })

    it('heading + paragraphs → 1 chunk, multiple text nodes', () => {
      const json = makeEditorState([
        heading('h2', textNode('Title')),
        paragraph(textNode('First paragraph')),
        paragraph(textNode('Second paragraph')),
      ])
      const { chunks } = parseLexicalForTranslation(json)

      expect(chunks).toHaveLength(1)
      expect(chunks[0].textNodes).toHaveLength(3)
      expect(chunks[0].textNodes[0].originalText).toBe('Title')
      expect(chunks[0].textNodes[1].originalText).toBe('First paragraph')
      expect(chunks[0].textNodes[2].originalText).toBe('Second paragraph')
    })

    it('paragraph + code + paragraph → 2 chunks', () => {
      const json = makeEditorState([
        paragraph(textNode('Before code')),
        codeBlock('const x = 1', 'typescript'),
        paragraph(textNode('After code')),
      ])
      const { chunks } = parseLexicalForTranslation(json)

      expect(chunks).toHaveLength(2)
      expect(chunks[0].textNodes).toHaveLength(1)
      expect(chunks[0].textNodes[0].originalText).toBe('Before code')
      expect(chunks[1].textNodes).toHaveLength(1)
      expect(chunks[1].textNodes[0].originalText).toBe('After code')
    })

    it('all non-translatable → 0 chunks', () => {
      const json = makeEditorState([
        codeBlock('const a = 1'),
        { type: 'horizontalrule', version: 1 },
        codeBlock('const b = 2'),
      ])
      const { chunks } = parseLexicalForTranslation(json)

      expect(chunks).toHaveLength(0)
    })

    it('nested list with bold text → correct text node collection', () => {
      const json = makeEditorState([
        listNode(
          'bullet',
          { children: [textNode('Item one', 1)] },
          {
            children: [
              textNode('Item two'),
              listNode('bullet', {
                children: [textNode('Nested item', 2)],
              }),
            ],
          },
        ),
      ])
      const { chunks } = parseLexicalForTranslation(json)

      expect(chunks).toHaveLength(1)
      expect(chunks[0].textNodes).toHaveLength(3)
      expect(chunks[0].textNodes[0].originalText).toBe('Item one')
      expect(chunks[0].textNodes[1].originalText).toBe('Item two')
      expect(chunks[0].textNodes[2].originalText).toBe('Nested item')
    })

    it('nested editor content (alert-quote) collects text nodes', () => {
      const alertQuote = {
        type: 'alert-quote',
        alertType: 'info',
        content: {
          root: {
            children: [paragraph(textNode('Nested alert text'))],
            type: 'root',
            direction: 'ltr',
          },
        },
      }
      const json = makeEditorState([
        paragraph(textNode('Before')),
        alertQuote,
        paragraph(textNode('After')),
      ])
      const { chunks } = parseLexicalForTranslation(json)

      // alert-quote has nested content so it groups with adjacent translatables
      const allTexts = chunks.flatMap((c) =>
        c.textNodes.map((n) => n.originalText),
      )
      expect(allTexts).toContain('Before')
      expect(allTexts).toContain('Nested alert text')
      expect(allTexts).toContain('After')
    })

    it('empty text nodes are skipped', () => {
      const json = makeEditorState([
        paragraph(textNode(''), textNode('  '), textNode('Real text')),
      ])
      const { chunks } = parseLexicalForTranslation(json)

      expect(chunks).toHaveLength(1)
      expect(chunks[0].textNodes).toHaveLength(1)
      expect(chunks[0].textNodes[0].originalText).toBe('Real text')
    })
  })

  describe('restoreLexicalTranslation', () => {
    it('apply translations by ID, verify JSON output', () => {
      const json = makeEditorState([
        paragraph(textNode('Hello')),
        paragraph(textNode('World')),
      ])
      const { chunks, editorState } = parseLexicalForTranslation(json)

      const translations = new Map<string, string>([
        ['t_0', '你好'],
        ['t_1', '世界'],
      ])

      const result = restoreLexicalTranslation(
        editorState,
        translations,
        chunks,
      )
      const parsed = JSON.parse(result)

      expect(parsed.root.children[0].children[0].text).toBe('你好')
      expect(parsed.root.children[1].children[0].text).toBe('世界')
    })

    it('restores nested editor content (alert-quote)', () => {
      const alertQuote = {
        type: 'alert-quote',
        alertType: 'info',
        content: {
          root: {
            children: [paragraph(textNode('Alert text'))],
            type: 'root',
            direction: 'ltr',
          },
        },
      }
      const json = makeEditorState([alertQuote])
      const { chunks, editorState } = parseLexicalForTranslation(json)

      const translations = new Map<string, string>([['t_0', '警告文本']])
      const result = restoreLexicalTranslation(
        editorState,
        translations,
        chunks,
      )
      const parsed = JSON.parse(result)

      expect(
        parsed.root.children[0].content.root.children[0].children[0].text,
      ).toBe('警告文本')
    })

    it('missing translation falls back to original', () => {
      const json = makeEditorState([paragraph(textNode('Keep me'))])
      const { chunks, editorState } = parseLexicalForTranslation(json)

      const translations = new Map<string, string>()
      const result = restoreLexicalTranslation(
        editorState,
        translations,
        chunks,
      )
      const parsed = JSON.parse(result)

      expect(parsed.root.children[0].children[0].text).toBe('Keep me')
    })
  })

  describe('Markdown extraction', () => {
    it('heading produces correct Markdown', () => {
      const json = makeEditorState([heading('h2', textNode('My Title'))])
      const { chunks } = parseLexicalForTranslation(json)

      expect(chunks[0].markdown).toBe('## My Title')
    })

    it('paragraph produces plain text', () => {
      const json = makeEditorState([paragraph(textNode('Some text'))])
      const { chunks } = parseLexicalForTranslation(json)

      expect(chunks[0].markdown).toBe('Some text')
    })

    it('quote produces blockquote Markdown', () => {
      const json = makeEditorState([quoteNode(textNode('A quote'))])
      const { chunks } = parseLexicalForTranslation(json)

      expect(chunks[0].markdown).toBe('> A quote')
    })

    it('list produces bullet Markdown', () => {
      const json = makeEditorState([
        listNode(
          'bullet',
          { children: [textNode('First')] },
          { children: [textNode('Second')] },
        ),
      ])
      const { chunks } = parseLexicalForTranslation(json)

      expect(chunks[0].markdown).toContain('- First')
      expect(chunks[0].markdown).toContain('- Second')
    })

    it('link produces Markdown link', () => {
      const json = makeEditorState([
        paragraph(linkNode('https://example.com', textNode('Click here'))),
      ])
      const { chunks } = parseLexicalForTranslation(json)

      expect(chunks[0].markdown).toBe('[Click here](https://example.com)')
    })

    it('formatted text produces correct Markdown', () => {
      const json = makeEditorState([
        paragraph(
          textNode('bold', 1),
          textNode(' and '),
          textNode('italic', 2),
          textNode(' and '),
          textNode('code', 16),
        ),
      ])
      const { chunks } = parseLexicalForTranslation(json)

      expect(chunks[0].markdown).toBe('**bold** and *italic* and `code`')
    })

    it('multiple blocks joined with double newline', () => {
      const json = makeEditorState([
        heading('h1', textNode('Title')),
        paragraph(textNode('Body')),
      ])
      const { chunks } = parseLexicalForTranslation(json)

      expect(chunks[0].markdown).toBe('# Title\n\nBody')
    })
  })
})
