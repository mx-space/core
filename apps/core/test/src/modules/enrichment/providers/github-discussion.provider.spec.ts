import { describe, expect, it, vi } from 'vitest'

import type { GitHubClient } from '~/modules/enrichment/providers/github/github.client'
import { GitHubDiscussionProvider } from '~/modules/enrichment/providers/github/github-discussion.provider'

const createClient = (mockData: any) =>
  ({
    getOctokit: vi.fn().mockResolvedValue({
      graphql: vi.fn().mockResolvedValue(mockData),
    }),
  }) as unknown as GitHubClient

describe('GitHubDiscussionProvider', () => {
  describe('matchUrl', () => {
    const provider = new GitHubDiscussionProvider(createClient({}))

    it('matches github.com/owner/repo/discussions/123', () => {
      const result = provider.matchUrl(
        new URL('https://github.com/mx-space/core/discussions/42'),
      )
      expect(result).toEqual({
        id: 'mx-space/core/discussions/42',
        fullUrl: 'https://github.com/mx-space/core/discussions/42',
        subtype: 'discussion',
      })
    })

    it('rejects github.com/owner/repo/issues/123', () => {
      expect(
        provider.matchUrl(
          new URL('https://github.com/mx-space/core/issues/123'),
        ),
      ).toBeNull()
    })
  })

  describe('fetch', () => {
    it('queries GraphQL repository.discussion and normalizes', async () => {
      const mockData = {
        repository: {
          discussion: {
            title: 'Feature Request',
            body: 'Discussion body',
            url: 'https://github.com/mx-space/core/discussions/42',
            createdAt: '2023-06-01T00:00:00Z',
            updatedAt: '2023-07-01T00:00:00Z',
            author: { login: 'user', avatarUrl: 'https://avatar' },
            comments: { totalCount: 3 },
          },
        },
      }
      const p = new GitHubDiscussionProvider(createClient(mockData))

      const result = await p.fetch('mx-space/core/discussions/42')

      expect(result.title).toBe('Feature Request')
      expect(result.subtype).toBe('discussion')
      expect(result.url).toBe('https://github.com/mx-space/core/discussions/42')
      expect(result.thumbnailImage).toEqual({
        url: 'https://avatar',
        alt: 'user',
      })
      expect(result.previewImage?.url).toMatch(
        /^https:\/\/opengraph\.githubassets\.com\/.+\/mx-space\/core\/discussions\/42$/,
      )
      expect(result.previewImage?.width).toBe(1280)
      expect(result.previewImage?.height).toBe(640)
      expect(result.attributes).toContainEqual({
        key: 'repo',
        value: 'mx-space/core',
        label: 'Repository',
        format: 'text',
      })
      expect(result.attributes).toContainEqual({
        key: 'number',
        value: 42,
        label: 'Number',
        format: 'number',
      })
      expect(result.attributes).toContainEqual({
        key: 'comments',
        value: 3,
        label: 'Comments',
        format: 'number',
      })
      expect(result.attributes).toContainEqual({
        key: 'author',
        value: 'user',
        label: 'Author',
        format: 'text',
      })
    })

    it('handles ghost author (deleted user)', async () => {
      const mockData = {
        repository: {
          discussion: {
            title: 'Orphan',
            body: null,
            url: 'https://github.com/mx-space/core/discussions/1',
            createdAt: null,
            updatedAt: null,
            author: null,
            comments: { totalCount: 0 },
          },
        },
      }
      const p = new GitHubDiscussionProvider(createClient(mockData))

      const result = await p.fetch('mx-space/core/discussions/1')

      expect(result.thumbnailImage).toBeUndefined()
      expect(result.attributes).toContainEqual({
        key: 'author',
        value: '',
        label: 'Author',
        format: 'text',
      })
    })

    it('throws when discussion not found', async () => {
      const p = new GitHubDiscussionProvider(
        createClient({ repository: { discussion: null } }),
      )

      await expect(p.fetch('mx-space/core/discussions/999')).rejects.toThrow(
        'Discussion not found',
      )
    })

    it('throws when repository not found', async () => {
      const p = new GitHubDiscussionProvider(createClient({ repository: null }))

      await expect(p.fetch('ghost/repo/discussions/1')).rejects.toThrow(
        'Discussion not found',
      )
    })
  })
})
