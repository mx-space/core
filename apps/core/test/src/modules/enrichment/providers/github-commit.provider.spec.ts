import { describe, expect, it, vi } from 'vitest'

import type { GitHubClient } from '~/modules/enrichment/providers/github/github.client'
import { GitHubCommitProvider } from '~/modules/enrichment/providers/github/github-commit.provider'
import type { ImageMetaService } from '~/modules/enrichment/providers/image-meta.service'

const stubImageMeta = (result: any = null): ImageMetaService =>
  ({
    fetchAndExtract: vi.fn(async () => result),
  }) as unknown as ImageMetaService

const createClient = (mockData: Record<string, any>) =>
  ({
    getOctokit: vi.fn().mockResolvedValue({
      rest: {
        repos: { getCommit: vi.fn().mockResolvedValue({ data: mockData }) },
      },
    }),
  }) as unknown as GitHubClient

describe('GitHubCommitProvider', () => {
  describe('matchUrl', () => {
    const provider = new GitHubCommitProvider(createClient({}), stubImageMeta())

    it('matches github.com/owner/repo/commit/sha', () => {
      const result = provider.matchUrl(
        new URL('https://github.com/mx-space/core/commit/abc123def456'),
      )
      expect(result).toEqual({
        id: 'mx-space/core/commits/abc123def456',
        fullUrl: 'https://github.com/mx-space/core/commit/abc123def456',
        subtype: 'commit',
      })
    })

    it('rejects github.com/owner/repo/commits (plural)', () => {
      expect(
        provider.matchUrl(
          new URL('https://github.com/mx-space/core/commits/main'),
        ),
      ).toBeNull()
    })
  })

  describe('fetch', () => {
    it('splits commit message into title and description', async () => {
      const mockData = {
        html_url: 'https://github.com/mx-space/core/commit/abc123',
        commit: {
          message: 'Fix critical bug\n\nThis fixes issue #42.',
          author: { date: '2023-06-01T00:00:00Z' },
        },
        author: { avatar_url: 'https://avatar', login: 'dev' },
        stats: { additions: 10, deletions: 5 },
      }
      const p = new GitHubCommitProvider(
        createClient(mockData),
        stubImageMeta(),
      )

      const result = await p.fetch('mx-space/core/commits/abc123')

      expect(result.title).toBe('Fix critical bug')
      expect(result.description).toBe('This fixes issue #42.')
      expect(result.publishedAt).toBe('2023-06-01T00:00:00Z')
      expect(result.thumbnailImage).toEqual({
        url: 'https://avatar',
        alt: 'dev',
      })
      expect(result.previewImage?.url).toMatch(
        /^https:\/\/opengraph\.githubassets\.com\/.+\/mx-space\/core\/commit\/abc123$/,
      )
      expect(result.previewImage?.width).toBe(1280)
      expect(result.previewImage?.height).toBe(640)
    })

    it('merges fetched thumbhash/palette into thumbnail and preview images', async () => {
      const mockData = {
        html_url: 'https://github.com/mx-space/core/commit/abc123',
        commit: {
          message: 'Fix critical bug',
          author: { date: '2023-06-01T00:00:00Z' },
        },
        author: { avatar_url: 'https://avatar', login: 'dev' },
        stats: { additions: 10, deletions: 5 },
      }
      const meta = {
        width: 64,
        height: 64,
        thumbhash: 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH',
        palette: { dominant: '#abcdef' },
      }
      const p = new GitHubCommitProvider(
        createClient(mockData),
        stubImageMeta(meta),
      )

      const result = await p.fetch('mx-space/core/commits/abc123')

      expect(result.thumbnailImage?.thumbhash).toBe(meta.thumbhash)
      expect(result.thumbnailImage?.palette).toEqual(meta.palette)
      expect(result.previewImage?.thumbhash).toBe(meta.thumbhash)
      expect(result.previewImage?.palette).toEqual(meta.palette)
      expect(result.previewImage?.width).toBe(1280)
      expect(result.previewImage?.height).toBe(640)
    })

    it('omits thumbhash when ImageMetaService returns null', async () => {
      const mockData = {
        html_url: 'https://github.com/mx-space/core/commit/abc123',
        commit: {
          message: 'Fix critical bug',
          author: { date: '2023-06-01T00:00:00Z' },
        },
        author: { avatar_url: 'https://avatar', login: 'dev' },
        stats: { additions: 10, deletions: 5 },
      }
      const p = new GitHubCommitProvider(
        createClient(mockData),
        stubImageMeta(null),
      )

      const result = await p.fetch('mx-space/core/commits/abc123')

      expect(result.thumbnailImage?.url).toBe('https://avatar')
      expect(result.thumbnailImage?.thumbhash).toBeUndefined()
      expect(result.thumbnailImage?.palette).toBeUndefined()
      expect(result.previewImage?.url).toMatch(/opengraph\.githubassets\.com/)
      expect(result.previewImage?.thumbhash).toBeUndefined()
    })
  })
})
