import { describe, expect, it, vi } from 'vitest'

import type { GitHubClient } from '~/modules/enrichment/providers/github/github.client'
import { GitHubDiscussionProvider } from '~/modules/enrichment/providers/github/github-discussion.provider'

const createClient = (mockData: Record<string, any>) =>
  ({
    getOctokit: vi.fn().mockResolvedValue({
      request: vi.fn().mockResolvedValue({ data: mockData }),
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
    it('uses search API and normalizes discussion', async () => {
      const mockData = {
        items: [
          {
            title: 'Feature Request',
            body: 'Discussion body',
            html_url: 'https://github.com/mx-space/core/discussions/42',
            created_at: '2023-06-01T00:00:00Z',
            comments: 3,
            user: { avatar_url: 'https://avatar', login: 'user' },
          },
        ],
      }
      const p = new GitHubDiscussionProvider(createClient(mockData))

      const result = await p.fetch('mx-space/core/discussions/42')

      expect(result.title).toBe('Feature Request')
      expect(result.subtype).toBe('discussion')
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
    })

    it('throws when discussion not found', async () => {
      const p = new GitHubDiscussionProvider(createClient({ items: [] }))

      await expect(p.fetch('mx-space/core/discussions/999')).rejects.toThrow(
        'Discussion not found',
      )
    })
  })
})
