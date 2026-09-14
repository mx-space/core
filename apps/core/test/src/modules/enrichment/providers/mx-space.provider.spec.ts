import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MxSpaceProvider } from '~/modules/enrichment/providers/self/mx-space.provider'

// `pnpm test` runs vitest with `NODE_ENV=development`, which makes
// `isDev` truthy and short-circuits `matchUrl`'s host check. Force
// non-dev mode so the configured-host gate is exercised.
vi.mock('~/global/env.global', async () => {
  const actual = await vi.importActual<typeof import('~/global/env.global')>(
    '~/global/env.global',
  )
  return { ...actual, isDev: false }
})

describe('MxSpaceProvider', () => {
  let provider: MxSpaceProvider

  beforeEach(() => {
    provider = new MxSpaceProvider(
      null as any,
      null as any,
      null as any,
      null as any,
    )
    // Skip the async configsService bootstrap and pin the host directly.
    ;(provider as any).siteHost = 'example.com'
  })

  describe('matchUrl', () => {
    it('matches /posts/<category>/<slug>', () => {
      const result = provider.matchUrl(
        new URL('https://example.com/posts/tech/my-post'),
      )
      expect(result).toEqual({
        id: 'post:tech/my-post',
        fullUrl: 'https://example.com/posts/tech/my-post',
        subtype: 'post',
      })
    })

    it('matches /notes/<nid>', () => {
      const result = provider.matchUrl(new URL('https://example.com/notes/42'))
      expect(result).toEqual({
        id: 'note:42',
        fullUrl: 'https://example.com/notes/42',
        subtype: 'note',
      })
    })

    it('matches /notes/<year>/<month>/<day>/<slug>', () => {
      const result = provider.matchUrl(
        new URL('https://example.com/notes/2026/5/5/hello'),
      )
      expect(result).toEqual({
        id: 'note-date:2026/5/5/hello',
        fullUrl: 'https://example.com/notes/2026/5/5/hello',
        subtype: 'note',
      })
    })

    it('rejects /notes/abc (non-numeric, non-date)', () => {
      expect(
        provider.matchUrl(new URL('https://example.com/notes/abc')),
      ).toBeNull()
    })

    it('rejects /pages/about', () => {
      expect(
        provider.matchUrl(new URL('https://example.com/pages/about')),
      ).toBeNull()
    })

    it('rejects URL whose hostname does not match the configured site', () => {
      expect(
        provider.matchUrl(new URL('https://other.com/posts/tech/my-post')),
      ).toBeNull()
    })
  })

  describe('isValidId', () => {
    it('accepts post:<cat>/<slug>', () => {
      expect(provider.isValidId('post:tech/my-slug')).toBe(true)
    })
    it('accepts note:<nid>', () => {
      expect(provider.isValidId('note:42')).toBe(true)
    })
    it('accepts note-date:<y>/<m>/<d>/<slug>', () => {
      expect(provider.isValidId('note-date:2026/5/5/hello')).toBe(true)
    })
    it('rejects unknown prefix', () => {
      expect(provider.isValidId('unknown:123')).toBe(false)
    })
  })

  describe('fetch', () => {
    const lexical = (...texts: string[]) =>
      JSON.stringify({
        root: {
          type: 'root',
          version: 1,
          children: texts.map((text) => ({
            type: 'paragraph',
            version: 1,
            children: [{ type: 'text', version: 1, text }],
          })),
        },
      })

    const basePost = {
      id: 'post-1',
      title: 'Post',
      text: 'one\n\ntwo\n\nSECRET',
      content: lexical('one', 'two', 'SECRET'),
      summary: null,
      isPublished: true,
      isPremium: false,
      meta: { paywall: { previewBlocks: 2 } },
    }

    let databaseService: {
      findPostBySlug: ReturnType<typeof vi.fn>
      findNoteByNid: ReturnType<typeof vi.fn>
    }
    let aiSummaryService: {
      batchGetSummariesByRefIds: ReturnType<typeof vi.fn>
    }

    beforeEach(() => {
      databaseService = {
        findPostBySlug: vi.fn(),
        findNoteByNid: vi.fn(),
      }
      aiSummaryService = {
        batchGetSummariesByRefIds: vi
          .fn()
          .mockResolvedValue(new Map([['post-1', 'AI summary with SECRET']])),
      }
      provider = new MxSpaceProvider(
        databaseService as any,
        null as any,
        aiSummaryService as any,
        {
          findCachedTitlesByRefIds: vi.fn().mockResolvedValue(new Map()),
        } as any,
      )
    })

    it('uses the AI summary for a published non-premium post', async () => {
      databaseService.findPostBySlug.mockResolvedValue(basePost)
      const result = await provider.fetch('post:tech/my-post', 'en')
      expect(result.description).toBe('AI summary with SECRET')
    })

    it('treats an unpublished post as not found', async () => {
      databaseService.findPostBySlug.mockResolvedValue({
        ...basePost,
        isPublished: false,
      })
      await expect(provider.fetch('post:tech/my-post')).rejects.toThrow(
        'Post not found',
      )
    })

    it('describes a premium post with only the public teaser', async () => {
      databaseService.findPostBySlug.mockResolvedValue({
        ...basePost,
        isPremium: true,
      })
      const result = await provider.fetch('post:tech/my-post', 'en')
      expect(result.description).toBe('one\n\ntwo')
      expect(aiSummaryService.batchGetSummariesByRefIds).not.toHaveBeenCalled()
    })

    it('treats an unpublished note as not found', async () => {
      databaseService.findNoteByNid.mockResolvedValue({
        id: 'note-1',
        nid: 42,
        title: 'Draft',
        text: 'SECRET',
        isPublished: false,
      })
      await expect(provider.fetch('note:42')).rejects.toThrow('Note not found')
    })

    it('treats a password-protected note as not found', async () => {
      databaseService.findNoteByNid.mockResolvedValue({
        id: 'note-1',
        nid: 42,
        title: 'Locked',
        text: 'SECRET',
        isPublished: true,
        hasPassword: true,
      })
      await expect(provider.fetch('note:42')).rejects.toThrow('Note not found')
    })
  })
})
