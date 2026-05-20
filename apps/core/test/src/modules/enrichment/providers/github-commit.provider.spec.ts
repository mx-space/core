import { describe, expect, it, vi } from 'vitest'

import type { GitHubClient } from '~/modules/enrichment/providers/github/github.client'
import { GitHubCommitProvider } from '~/modules/enrichment/providers/github/github-commit.provider'

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
    const provider = new GitHubCommitProvider(createClient({}))

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
      const p = new GitHubCommitProvider(createClient(mockData))

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
  })
})
