import { describe, expect, it, vi } from 'vitest'

import type { GitHubPullRequestApiResponse } from '~/modules/enrichment/providers/api-response.types'
import { GitHubPrProvider } from '~/modules/enrichment/providers/github/github-pr.provider'
import type { GitHubClient } from '~/modules/enrichment/providers/github/github.client'

const createClient = () =>
  ({ fetch: vi.fn(), getOctokit: vi.fn() }) as unknown as GitHubClient

describe('GitHubPrProvider', () => {
  const provider = new GitHubPrProvider(createClient())

  describe('matchUrl', () => {
    it('matches github.com/owner/repo/pull/123', () => {
      const result = provider.matchUrl(
        new URL('https://github.com/mx-space/core/pull/42'),
      )
      expect(result).toEqual({
        id: 'mx-space/core/pulls/42',
        fullUrl: 'https://github.com/mx-space/core/pull/42',
        subtype: 'pr',
      })
    })

    it('rejects github.com/owner/repo/issues/123', () => {
      expect(
        provider.matchUrl(new URL('https://github.com/mx-space/core/issues/123')),
      ).toBeNull()
    })
  })

  describe('fetch', () => {
    it('normalizes PR response with merged state', async () => {
      const client = createClient()
      const mockData: GitHubPullRequestApiResponse = {
        number: 42,
        title: 'Fix bug',
        body: 'PR description',
        html_url: 'https://github.com/mx-space/core/pull/42',
        state: 'closed',
        merged: true,
        additions: 100,
        deletions: 20,
        created_at: '2023-06-01T00:00:00Z',
        user: { avatar_url: 'https://avatar', login: 'dev' },
      }
      vi.mocked(client.fetch).mockResolvedValue(mockData)
      const p = new GitHubPrProvider(client)

      const result = await p.fetch('mx-space/core/pulls/42')

      expect(result.title).toBe('mx-space/core#42: Fix bug')
      expect(result.subtype).toBe('pr')
      expect(result.attributes).toContainEqual({ key: 'merged', value: true, label: 'Merged' })
      expect(result.attributes).toContainEqual({
        key: 'additions',
        value: 100,
        label: 'Additions',
        format: 'number',
      })
    })
  })
})
