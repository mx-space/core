import { describe, expect, it, vi } from 'vitest'

import type { GitHubClient } from '~/modules/enrichment/providers/github/github.client'
import { GitHubIssueProvider } from '~/modules/enrichment/providers/github/github-issue.provider'
import type { ImageMetaService } from '~/modules/enrichment/providers/image-meta.service'

const stubImageMeta = (result: any = null): ImageMetaService =>
  ({
    fetchAndExtract: vi.fn(async () => result),
  }) as unknown as ImageMetaService

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
    const provider = new GitHubIssueProvider(createClient({}), stubImageMeta())

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
        updated_at: '2023-07-01T00:00:00Z',
        user: { avatar_url: 'https://avatar', login: 'testuser' },
      }
      const p = new GitHubIssueProvider(createClient(mockData), stubImageMeta())

      const result = await p.fetch('mx-space/core/issues/42')

      expect(result.title).toBe('Bug fix')
      expect(result.subtype).toBe('issue')
      expect(result.thumbnailImage).toEqual({
        url: 'https://avatar',
        alt: 'testuser',
      })
      expect(result.previewImage?.url).toMatch(
        /^https:\/\/opengraph\.githubassets\.com\/.+\/mx-space\/core\/issues\/42$/,
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

    it('merges fetched thumbhash/palette into thumbnail and preview images', async () => {
      const mockData = {
        number: 42,
        title: 'Bug fix',
        body: 'Body text',
        html_url: 'https://github.com/mx-space/core/issues/42',
        state: 'open',
        comments: 5,
        created_at: '2023-06-01T00:00:00Z',
        updated_at: '2023-07-01T00:00:00Z',
        user: { avatar_url: 'https://avatar', login: 'testuser' },
      }
      const meta = {
        width: 64,
        height: 64,
        thumbhash: 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH',
        palette: { dominant: '#abcdef' },
      }
      const p = new GitHubIssueProvider(
        createClient(mockData),
        stubImageMeta(meta),
      )

      const result = await p.fetch('mx-space/core/issues/42')

      expect(result.thumbnailImage?.thumbhash).toBe(meta.thumbhash)
      expect(result.thumbnailImage?.palette).toEqual(meta.palette)
      expect(result.previewImage?.thumbhash).toBe(meta.thumbhash)
      expect(result.previewImage?.palette).toEqual(meta.palette)
      expect(result.previewImage?.width).toBe(1280)
      expect(result.previewImage?.height).toBe(640)
    })

    it('omits thumbhash when ImageMetaService returns null', async () => {
      const mockData = {
        number: 42,
        title: 'Bug fix',
        body: 'Body text',
        html_url: 'https://github.com/mx-space/core/issues/42',
        state: 'open',
        comments: 5,
        created_at: '2023-06-01T00:00:00Z',
        updated_at: '2023-07-01T00:00:00Z',
        user: { avatar_url: 'https://avatar', login: 'testuser' },
      }
      const p = new GitHubIssueProvider(
        createClient(mockData),
        stubImageMeta(null),
      )

      const result = await p.fetch('mx-space/core/issues/42')

      expect(result.thumbnailImage?.url).toBe('https://avatar')
      expect(result.thumbnailImage?.thumbhash).toBeUndefined()
      expect(result.thumbnailImage?.palette).toBeUndefined()
      expect(result.previewImage?.url).toMatch(/opengraph\.githubassets\.com/)
      expect(result.previewImage?.thumbhash).toBeUndefined()
    })
  })
})
