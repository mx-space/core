import { describe, expect, it, vi } from 'vitest'

import type { GitHubClient } from '~/modules/enrichment/providers/github/github.client'
import { GitHubIssueProvider } from '~/modules/enrichment/providers/github/github-issue.provider'

const createClient = (mockData: Record<string, any>) =>
  ({
    getOctokit: vi.fn().mockResolvedValue({
      rest: {
        issues: { get: vi.fn().mockResolvedValue({ data: mockData }) },
      },
    }),
  }) as unknown as GitHubClient

describe('GitHubIssueProvider', () => {
  describe('matchUrl', () => {
    const provider = new GitHubIssueProvider(createClient({}))

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
      const mockData = {
        number: 42,
        title: 'Bug fix',
        body: 'Body text',
        html_url: 'https://github.com/mx-space/core/issues/42',
        state: 'open',
        comments: 5,
        created_at: '2023-06-01T00:00:00Z',
        user: { avatar_url: 'https://avatar', login: 'testuser' },
      }
      const p = new GitHubIssueProvider(createClient(mockData))

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
