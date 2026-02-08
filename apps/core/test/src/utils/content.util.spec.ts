import { ContentFormat } from '~/shared/types/content-format.type'
import {
  computeContentHash,
  extractImagesFromContent,
  getTranslationPayload,
  isLexical,
} from '~/utils/content.util'

describe('content.util', () => {
  describe('isLexical', () => {
    it('markdown → false', () => {
      expect(isLexical({ contentFormat: ContentFormat.Markdown })).toBe(false)
    })
    it('lexical → true', () => {
      expect(isLexical({ contentFormat: ContentFormat.Lexical })).toBe(true)
    })
    it('undefined → false', () => {
      expect(isLexical({})).toBe(false)
    })
  })

  describe('extractImagesFromContent', () => {
    it('markdown: extract images from text', () => {
      const doc = {
        title: 'test',
        text: '![img](https://example.com/a.png)\n\nsome text\n\n![img2](https://example.com/b.jpg)',
        contentFormat: ContentFormat.Markdown,
      }
      const images = extractImagesFromContent(doc)
      expect(images).toEqual([
        'https://example.com/a.png',
        'https://example.com/b.jpg',
      ])
    })

    it('lexical: extract images from content JSON', () => {
      const doc = {
        title: 'test',
        text: '',
        contentFormat: ContentFormat.Lexical,
        content: JSON.stringify({
          root: {
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'hello' }],
              },
              {
                type: 'image',
                src: 'https://example.com/a.png',
              },
              {
                type: 'paragraph',
                children: [
                  {
                    type: 'image',
                    src: 'https://example.com/b.jpg',
                  },
                ],
              },
            ],
          },
        }),
      }
      const images = extractImagesFromContent(doc)
      expect(images).toEqual([
        'https://example.com/a.png',
        'https://example.com/b.jpg',
      ])
    })

    it('lexical: returns empty on invalid JSON', () => {
      const doc = {
        title: 'test',
        text: '',
        contentFormat: ContentFormat.Lexical,
        content: 'not json',
      }
      expect(extractImagesFromContent(doc)).toEqual([])
    })
  })

  describe('getTranslationPayload', () => {
    it('markdown → returns text', () => {
      const result = getTranslationPayload({
        title: 'Title',
        text: 'Hello',
        contentFormat: ContentFormat.Markdown,
      })
      expect(result).toEqual({
        format: 'markdown',
        title: 'Title',
        text: 'Hello',
      })
    })

    it('lexical → returns content', () => {
      const result = getTranslationPayload({
        title: 'Title',
        text: '',
        contentFormat: ContentFormat.Lexical,
        content: '{"root":{}}',
      })
      expect(result).toEqual({
        format: 'lexical',
        title: 'Title',
        content: '{"root":{}}',
      })
    })
  })

  describe('computeContentHash', () => {
    it('markdown: hash based on text', () => {
      const doc = {
        title: 'T',
        text: 'hello',
        contentFormat: ContentFormat.Markdown,
      }
      const hash = computeContentHash(doc, 'en')
      expect(typeof hash).toBe('string')
      expect(hash.length).toBe(32)
    })

    it('lexical: hash based on content', () => {
      const doc = {
        title: 'T',
        text: 'degraded',
        contentFormat: ContentFormat.Lexical,
        content: '{"root":{}}',
      }
      const hash = computeContentHash(doc, 'en')
      expect(typeof hash).toBe('string')
      expect(hash.length).toBe(32)
    })

    it('same doc different format → different hash', () => {
      const base = { title: 'T', text: 'hello', content: '{"root":{}}' }
      const h1 = computeContentHash(
        { ...base, contentFormat: ContentFormat.Markdown },
        'en',
      )
      const h2 = computeContentHash(
        { ...base, contentFormat: ContentFormat.Lexical },
        'en',
      )
      expect(h1).not.toBe(h2)
    })
  })
})
