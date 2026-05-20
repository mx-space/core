import { describe, expect, it, vi } from 'vitest'

import type { GitHubClient } from '~/modules/enrichment/providers/github/github.client'
import { GitHubPrProvider } from '~/modules/enrichment/providers/github/github-pr.provider'
import type { ImageMetaService } from '~/modules/enrichment/providers/image-meta.service'

const stubImageMeta = (result: any = null): ImageMetaService =>
  ({
    fetchAndExtract: vi.fn(async () => result),
  }) as unknown as ImageMetaService

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
    const provider = new GitHubPrProvider(createClient({}), stubImageMeta())

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
        updated_at: '2023-07-01T00:00:00Z',
        user: { avatar_url: 'https://avatar', login: 'dev' },
      }
      const p = new GitHubPrProvider(createClient(mockData), stubImageMeta())

      const result = await p.fetch('mx-space/core/pulls/42')

      expect(result.title).toBe('Fix bug')
      expect(result.subtype).toBe('pr')
      expect(result.thumbnailImage).toEqual({
        url: 'https://avatar',
        alt: 'dev',
      })
      expect(result.previewImage?.url).toMatch(
        /^https:\/\/opengraph\.githubassets\.com\/.+\/mx-space\/core\/pull\/42$/,
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

    it('merges fetched blurhash/palette into thumbnail and preview images', async () => {
      const mockData = {
        number: 42,
        title: 'Fix bug',
        body: 'PR description',
        html_url: 'https://github.com/mx-space/core/pull/42',
        state: 'open',
        merged: false,
        created_at: '2023-06-01T00:00:00Z',
        updated_at: '2023-07-01T00:00:00Z',
        user: { avatar_url: 'https://avatar', login: 'dev' },
      }
      const meta = {
        width: 64,
        height: 64,
        blurhash: 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH',
        palette: { dominant: '#abcdef' },
      }
      const p = new GitHubPrProvider(
        createClient(mockData),
        stubImageMeta(meta),
      )

      const result = await p.fetch('mx-space/core/pulls/42')

      expect(result.thumbnailImage?.blurhash).toBe(meta.blurhash)
      expect(result.thumbnailImage?.palette).toEqual(meta.palette)
      expect(result.previewImage?.blurhash).toBe(meta.blurhash)
      expect(result.previewImage?.palette).toEqual(meta.palette)
      expect(result.previewImage?.width).toBe(1280)
      expect(result.previewImage?.height).toBe(640)
    })

    it('omits blurhash when ImageMetaService returns null', async () => {
      const mockData = {
        number: 42,
        title: 'Fix bug',
        body: 'PR description',
        html_url: 'https://github.com/mx-space/core/pull/42',
        state: 'open',
        merged: false,
        created_at: '2023-06-01T00:00:00Z',
        updated_at: '2023-07-01T00:00:00Z',
        user: { avatar_url: 'https://avatar', login: 'dev' },
      }
      const p = new GitHubPrProvider(
        createClient(mockData),
        stubImageMeta(null),
      )

      const result = await p.fetch('mx-space/core/pulls/42')

      expect(result.thumbnailImage?.url).toBe('https://avatar')
      expect(result.thumbnailImage?.blurhash).toBeUndefined()
      expect(result.thumbnailImage?.palette).toBeUndefined()
      expect(result.previewImage?.url).toMatch(/opengraph\.githubassets\.com/)
      expect(result.previewImage?.blurhash).toBeUndefined()
    })
  })
})
