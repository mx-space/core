import { describe, expect, it, vi } from 'vitest'

import type { GitHubClient } from '~/modules/enrichment/providers/github/github.client'
import { GitHubPrProvider } from '~/modules/enrichment/providers/github/github-pr.provider'

const createClient = (mockData: Record<string, any>) =>
  ({
    getOctokit: vi.fn().mockResolvedValue({
      rest: {
        pulls: { get: vi.fn().mockResolvedValue({ data: mockData }) },
      },
    }),
  }) as unknown as GitHubClient

describe('GitHubPrProvider', () => {
  describe('matchUrl', () => {
    const provider = new GitHubPrProvider(createClient({}))

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
        provider.matchUrl(
          new URL('https://github.com/mx-space/core/issues/123'),
        ),
      ).toBeNull()
    })
  })

  describe('fetch', () => {
    it('normalizes PR response with merged state', async () => {
      const mockData = {
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
      const p = new GitHubPrProvider(createClient(mockData))

      const result = await p.fetch('mx-space/core/pulls/42')

      expect(result.title).toBe('mx-space/core#42: Fix bug')
      expect(result.subtype).toBe('pr')
      expect(result.attributes).toContainEqual({
        key: 'merged',
        value: true,
        label: 'Merged',
      })
      expect(result.attributes).toContainEqual({
        key: 'additions',
        value: 100,
        label: 'Additions',
        format: 'number',
      })
    })
  })
})
