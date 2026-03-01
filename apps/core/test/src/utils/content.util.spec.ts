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

    it('markdown: same input → stable hash', () => {
      const doc = { title: 'T', text: 'body', summary: 's', tags: ['a'] }
      expect(computeContentHash(doc, 'en')).toBe(computeContentHash(doc, 'en'))
    })

    it('markdown: different text → different hash', () => {
      const a = computeContentHash({ title: 'T', text: 'v1' }, 'en')
      const b = computeContentHash({ title: 'T', text: 'v2' }, 'en')
      expect(a).not.toBe(b)
    })

    it('different sourceLang → different hash', () => {
      const doc = { title: 'T', text: 'body' }
      expect(computeContentHash(doc, 'en')).not.toBe(
        computeContentHash(doc, 'zh'),
      )
    })

    it('lexical: ignores blockId-only changes', () => {
      const contentA = JSON.stringify({
        root: {
          type: 'root',
          version: 1,
          format: '',
          indent: 0,
          direction: null,
          children: [
            {
              type: 'paragraph',
              version: 1,
              format: '',
              indent: 0,
              direction: null,
              $: { blockId: 'aaaa1111' },
              children: [
                {
                  type: 'text',
                  version: 1,
                  text: 'hello',
                  detail: 0,
                  format: 0,
                  mode: 'normal',
                  style: '',
                },
              ],
            },
          ],
        },
      })

      const contentB = JSON.stringify({
        root: {
          direction: null,
          indent: 0,
          format: '',
          version: 1,
          type: 'root',
          children: [
            {
              direction: null,
              indent: 0,
              format: '',
              version: 1,
              type: 'paragraph',
              $: { blockId: 'bbbb2222' },
              children: [
                {
                  style: '',
                  mode: 'normal',
                  format: 0,
                  detail: 0,
                  text: 'hello',
                  version: 1,
                  type: 'text',
                },
              ],
            },
          ],
        },
      })

      const hashA = computeContentHash(
        {
          title: 'T',
          text: 'degraded',
          contentFormat: ContentFormat.Lexical,
          content: contentA,
        },
        'en',
      )
      const hashB = computeContentHash(
        {
          title: 'T',
          text: 'degraded',
          contentFormat: ContentFormat.Lexical,
          content: contentB,
        },
        'en',
      )

      expect(hashA).toBe(hashB)
    })

    it('lexical: keeps semantic text changes hash-sensitive', () => {
      const contentA = JSON.stringify({
        root: {
          children: [
            {
              type: 'paragraph',
              version: 1,
              $: { blockId: 'same1111' },
              children: [{ type: 'text', version: 1, text: 'hello' }],
            },
          ],
        },
      })
      const contentB = JSON.stringify({
        root: {
          children: [
            {
              type: 'paragraph',
              version: 1,
              $: { blockId: 'same1111' },
              children: [{ type: 'text', version: 1, text: 'hello world' }],
            },
          ],
        },
      })

      const hashA = computeContentHash(
        {
          title: 'T',
          text: 'degraded',
          contentFormat: ContentFormat.Lexical,
          content: contentA,
        },
        'en',
      )
      const hashB = computeContentHash(
        {
          title: 'T',
          text: 'degraded',
          contentFormat: ContentFormat.Lexical,
          content: contentB,
        },
        'en',
      )

      expect(hashA).not.toBe(hashB)
    })
  })
})
