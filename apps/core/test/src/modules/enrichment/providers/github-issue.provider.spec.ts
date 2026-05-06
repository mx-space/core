import { describe, expect, it, vi } from 'vitest'

import type { GitHubIssueApiResponse } from '~/modules/enrichment/providers/api-response.types'
import { GitHubIssueProvider } from '~/modules/enrichment/providers/github/github-issue.provider'
import type { GitHubClient } from '~/modules/enrichment/providers/github/github.client'

const createClient = () =>
  ({ fetch: vi.fn(), getOctokit: vi.fn() }) as unknown as GitHubClient

describe('GitHubIssueProvider', () => {
  const provider = new GitHubIssueProvider(createClient())

  describe('matchUrl', () => {
    it('matches github.com/owner/repo/issues/123', () => {
      const result = provider.matchUrl(
        new URL('https://github.com/mx-space/core/issues/42'),
      )
      expect(result).toEqual({
        id: 'mx-space/core/issues/42',
        fullUrl: 'https://github.com/mx-space/core/issues/42',
        subtype: 'issue',
      })
    })

    it('rejects github.com/owner/repo/pull/123', () => {
      expect(
        provider.matchUrl(new URL('https://github.com/mx-space/core/pull/123')),
      ).toBeNull()
    })

    it('rejects github.com/owner/repo (2 segments)', () => {
      expect(
        provider.matchUrl(new URL('https://github.com/mx-space/core')),
      ).toBeNull()
    })

    it('rejects github.com/owner/repo/issues (no number)', () => {
      expect(
        provider.matchUrl(new URL('https://github.com/mx-space/core/issues')),
      ).toBeNull()
    })
  })

  describe('fetch', () => {
    it('normalizes issue response', async () => {
      const client = createClient()
      const mockData: GitHubIssueApiResponse = {
        number: 42,
        title: 'Bug fix',
        body: 'Body text',
        html_url: 'https://github.com/mx-space/core/issues/42',
        state: 'open',
        comments: 5,
        created_at: '2023-06-01T00:00:00Z',
        user: { avatar_url: 'https://avatar', login: 'testuser' },
      }
      vi.mocked(client.fetch).mockResolvedValue(mockData)
      const p = new GitHubIssueProvider(client)

      const result = await p.fetch('mx-space/core/issues/42')

      expect(result.title).toBe('mx-space/core#42: Bug fix')
      expect(result.subtype).toBe('issue')
      expect(result.attributes).toContainEqual({
        key: 'state',
        value: 'open',
        label: 'State',
        format: 'text',
      })
      expect(result.attributes).toContainEqual({
        key: 'author',
        value: 'testuser',
        label: 'Author',
        format: 'text',
      })
    })
  })
})
