import { describe, expect, it, vi } from 'vitest'

import type { GitHubDiscussionSearchApiResponse } from '~/modules/enrichment/providers/api-response.types'
import { GitHubDiscussionProvider } from '~/modules/enrichment/providers/github/github-discussion.provider'
import type { GitHubClient } from '~/modules/enrichment/providers/github/github.client'

const createClient = () =>
  ({ fetch: vi.fn(), getOctokit: vi.fn() }) as unknown as GitHubClient

describe('GitHubDiscussionProvider', () => {
  const provider = new GitHubDiscussionProvider(createClient())

  describe('matchUrl', () => {
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
        provider.matchUrl(new URL('https://github.com/mx-space/core/issues/123')),
      ).toBeNull()
    })
  })

  describe('fetch', () => {
    it('uses search API and normalizes discussion', async () => {
      const client = createClient()
      const mockData: GitHubDiscussionSearchApiResponse = {
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
      vi.mocked(client.fetch).mockResolvedValue(mockData)
      const p = new GitHubDiscussionProvider(client)

      const result = await p.fetch('mx-space/core/discussions/42')

      expect(result.title).toBe('Feature Request')
      expect(result.subtype).toBe('discussion')
      expect(result.attributes).toContainEqual({
        key: 'comments',
        value: 3,
        label: 'Comments',
        format: 'number',
      })
    })

    it('throws when discussion not found', async () => {
      const client = createClient()
      vi.mocked(client.fetch).mockResolvedValue({ items: [] })
      const p = new GitHubDiscussionProvider(client)

      await expect(p.fetch('mx-space/core/discussions/999')).rejects.toThrow(
        'Discussion not found',
      )
    })
  })
})
