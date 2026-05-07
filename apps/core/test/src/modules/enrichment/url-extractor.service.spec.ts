import { describe, expect, it } from 'vitest'

import { UrlExtractorService } from '~/modules/enrichment/url-extractor.service'

describe('UrlExtractorService', () => {
  const svc = new UrlExtractorService()

  describe('extractFromMarkdown', () => {
    it('extracts a paragraph that is just one link', () => {
      const md = `Some intro\n\n[Vercel](https://vercel.com)\n\nMore text.`
      expect(svc.extractFromMarkdown(md)).toEqual(['https://vercel.com'])
    })

    it('extracts multiple block-link paragraphs', () => {
      const md = [
        'Intro',
        '',
        '[A](https://a.com)',
        '',
        '[B](https://b.com)',
      ].join('\n')
      expect(svc.extractFromMarkdown(md)).toEqual([
        'https://a.com',
        'https://b.com',
      ])
    })

    it('ignores inline link inside text', () => {
      const md = `Check out [my site](https://example.com) for more.`
      expect(svc.extractFromMarkdown(md)).toEqual([])
    })

    it('ignores image-only paragraphs', () => {
      const md = `![alt](https://example.com/img.png)`
      expect(svc.extractFromMarkdown(md)).toEqual([])
    })

    it('extracts reference-style single-link paragraphs (resolved by marked)', () => {
      const md = `[ref][1]\n\n[1]: https://example.com`
      expect(svc.extractFromMarkdown(md)).toEqual(['https://example.com'])
    })

    it('handles autolinks (URL wrapped in <>)', () => {
      const md = `<https://github.com/vercel/next.js>`
      expect(svc.extractFromMarkdown(md)).toEqual([
        'https://github.com/vercel/next.js',
      ])
    })

    it('dedupes the same URL appearing twice', () => {
      const md = `[A](https://a.com)\n\n[A again](https://a.com)`
      expect(svc.extractFromMarkdown(md)).toEqual(['https://a.com'])
    })

    it('returns empty for null / empty input', () => {
      expect(svc.extractFromMarkdown(null)).toEqual([])
      expect(svc.extractFromMarkdown(undefined)).toEqual([])
      expect(svc.extractFromMarkdown('')).toEqual([])
    })

    it('does not extract from a link wrapped in formatting (bold)', () => {
      const md = `**[Bold link](https://b.com)**`
      expect(svc.extractFromMarkdown(md)).toEqual([])
    })
  })

  describe('extractFromLexical', () => {
    it('finds a top-level link-card node', () => {
      const state = {
        root: {
          children: [
            { type: 'paragraph', children: [{ type: 'text', text: 'hi' }] },
            { type: 'link-card', url: 'https://github.com/vercel/next.js' },
          ],
        },
      }
      expect(svc.extractFromLexical(state)).toEqual([
        'https://github.com/vercel/next.js',
      ])
    })

    it('finds nested link-card nodes', () => {
      const state = {
        root: {
          children: [
            {
              type: 'list',
              children: [
                {
                  type: 'listitem',
                  children: [{ type: 'link-card', url: 'https://a.com' }],
                },
              ],
            },
          ],
        },
      }
      expect(svc.extractFromLexical(state)).toEqual(['https://a.com'])
    })

    it('dedupes duplicate URLs', () => {
      const state = {
        root: {
          children: [
            { type: 'link-card', url: 'https://a.com' },
            { type: 'link-card', url: 'https://a.com' },
          ],
        },
      }
      expect(svc.extractFromLexical(state)).toEqual(['https://a.com'])
    })

    it('accepts a bare root node (no .root wrapper)', () => {
      const root = {
        children: [{ type: 'link-card', url: 'https://x.com' }],
      }
      expect(svc.extractFromLexical(root)).toEqual(['https://x.com'])
    })

    it('returns empty for malformed input', () => {
      expect(svc.extractFromLexical(null)).toEqual([])
      expect(svc.extractFromLexical(undefined)).toEqual([])
      expect(svc.extractFromLexical({})).toEqual([])
      expect(svc.extractFromLexical('not-an-object')).toEqual([])
    })

    it('skips link-card without url', () => {
      const state = {
        root: { children: [{ type: 'link-card', url: '' }] },
      }
      expect(svc.extractFromLexical(state)).toEqual([])
    })

    it('extracts single-link paragraphs (autolink child)', () => {
      const state = {
        root: {
          children: [
            {
              type: 'paragraph',
              children: [
                { type: 'autolink', url: 'https://innei.in/posts/cat/slug' },
              ],
            },
          ],
        },
      }
      expect(svc.extractFromLexical(state)).toEqual([
        'https://innei.in/posts/cat/slug',
      ])
    })

    it('extracts single-link paragraphs (link child)', () => {
      const state = {
        root: {
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'link', url: 'https://x.com/a' }],
            },
          ],
        },
      }
      expect(svc.extractFromLexical(state)).toEqual(['https://x.com/a'])
    })

    it('skips paragraphs containing link mixed with other text', () => {
      const state = {
        root: {
          children: [
            {
              type: 'paragraph',
              children: [
                { type: 'text', text: 'see ' },
                { type: 'link', url: 'https://x.com/a' },
              ],
            },
          ],
        },
      }
      expect(svc.extractFromLexical(state)).toEqual([])
    })
  })

  describe('extractFromDoc', () => {
    it('routes to markdown for non-lexical docs', () => {
      const doc = {
        contentFormat: 'markdown',
        text: '[A](https://a.com)',
      }
      expect(svc.extractFromDoc(doc)).toEqual(['https://a.com'])
    })

    it('routes to lexical for Lexical content format', () => {
      const lexicalJson = JSON.stringify({
        root: {
          children: [{ type: 'link-card', url: 'https://b.com' }],
        },
      })
      const doc = {
        contentFormat: 'lexical',
        content: lexicalJson,
        text: null,
      }
      expect(svc.extractFromDoc(doc)).toEqual(['https://b.com'])
    })

    it('falls back to text when lexical content is unparseable', () => {
      const doc = {
        contentFormat: 'lexical',
        content: 'not valid json',
        text: null,
      }
      expect(svc.extractFromDoc(doc)).toEqual([])
    })
  })
})
