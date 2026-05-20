import { describe, expect, it, vi } from 'vitest'

import type { GitHubClient } from '~/modules/enrichment/providers/github/github.client'
import { GitHubRepoProvider } from '~/modules/enrichment/providers/github/github-repo.provider'
import type { ImageMetaService } from '~/modules/enrichment/providers/image-meta.service'

const stubImageMeta = (result: any = null): ImageMetaService =>
  ({
    fetchAndExtract: vi.fn(async () => result),
  }) as unknown as ImageMetaService

const makeRepoResponse = (overrides: Record<string, any> = {}) => ({
  full_name: 'mx-space/core',
  description: 'Test description',
  html_url: 'https://github.com/mx-space/core',
  stargazers_count: 100,
  forks_count: 20,
  language: 'TypeScript',
  created_at: '2023-01-01T00:00:00Z',
  pushed_at: '2023-06-01T00:00:00Z',
  updated_at: '2023-05-01T00:00:00Z',
  owner: { avatar_url: 'https://avatar.url', login: 'mx-space' },
  license: { spdx_id: 'MIT' },
  ...overrides,
})

const createClient = (mockData: Record<string, any>) =>
  ({
    getOctokit: vi.fn().mockResolvedValue({
      rest: {
        repos: { get: vi.fn().mockResolvedValue({ data: mockData }) },
      },
    }),
  }) as unknown as GitHubClient

describe('GitHubRepoProvider', () => {
  describe('matchUrl', () => {
    const provider = new GitHubRepoProvider(createClient({}), stubImageMeta())

    it('matches github.com/owner/repo', () => {
      const result = provider.matchUrl(
        new URL('https://github.com/mx-space/core'),
      )
      expect(result).toEqual({
        id: 'mx-space/core',
        fullUrl: 'https://github.com/mx-space/core',
        subtype: 'repo',
      })
    })

    it('rejects github.com/owner (single segment)', () => {
      expect(
        provider.matchUrl(new URL('https://github.com/settings')),
      ).toBeNull()
    })

    it('rejects github.com/owner/repo/issues/1 (too many segments)', () => {
      expect(
        provider.matchUrl(new URL('https://github.com/mx-space/core/issues/1')),
      ).toBeNull()
    })

    it('rejects non-github.com domains', () => {
      expect(
        provider.matchUrl(new URL('https://gitlab.com/owner/repo')),
      ).toBeNull()
    })
  })

  describe('isValidId', () => {
    const provider = new GitHubRepoProvider(createClient({}), stubImageMeta())

    it('accepts owner/repo format', () => {
      expect(provider.isValidId('mx-space/core')).toBe(true)
    })
    it('rejects single segment', () => {
      expect(provider.isValidId('mx-space')).toBe(false)
    })
    it('rejects three segments', () => {
      expect(provider.isValidId('mx-space/core/extra')).toBe(false)
    })
  })

  describe('fetch', () => {
    it('normalizes GitHub API response with all fields', async () => {
      const p = new GitHubRepoProvider(
        createClient(makeRepoResponse()),
        stubImageMeta(),
      )

      const result = await p.fetch('mx-space/core')

      expect(result.title).toBe('mx-space/core')
      expect(result.category).toBe('github')
      expect(result.subtype).toBe('repo')
      expect(result.description).toBe('Test description')
      expect(result.thumbnailImage).toEqual({
        url: 'https://avatar.url',
        alt: 'mx-space avatar',
      })
      expect(result.previewImage?.url).toMatch(
        /^https:\/\/opengraph\.githubassets\.com\/.+\/mx-space\/core$/,
      )
      expect(result.previewImage?.width).toBe(1280)
      expect(result.previewImage?.height).toBe(640)
      expect(result.publishedAt).toBe('2023-01-01T00:00:00Z')
      expect(result.color).toBe('TypeScript')

      const attrs = result.attributes!
      expect(attrs).toContainEqual({
        key: 'stars',
        value: 100,
        label: 'Stars',
        format: 'number',
      })
      expect(attrs).toContainEqual({
        key: 'forks',
        value: 20,
        label: 'Forks',
        format: 'number',
      })
      expect(attrs).toContainEqual({
        key: 'language',
        value: 'TypeScript',
        label: 'Language',
        format: 'text',
      })
      expect(attrs).toContainEqual({
        key: 'license',
        value: 'MIT',
        label: 'License',
        format: 'text',
      })
    })

    it('handles missing optional fields gracefully', async () => {
      const p = new GitHubRepoProvider(
        createClient(
          makeRepoResponse({
            description: null,
            language: null,
            owner: null,
            license: null,
            stargazers_count: null,
            forks_count: null,
          }),
        ),
        stubImageMeta(),
      )

      const result = await p.fetch('mx-space/core')

      expect(result.title).toBe('mx-space/core')
      expect(result.description).toBeUndefined()
      expect(result.thumbnailImage).toBeUndefined()
      expect(result.color).toBeUndefined()
      expect(result.attributes).toEqual([])
    })

    it('merges fetched blurhash/palette into thumbnail and preview images', async () => {
      const meta = {
        width: 64,
        height: 64,
        blurhash: 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH',
        palette: { dominant: '#abcdef' },
      }
      const p = new GitHubRepoProvider(
        createClient(makeRepoResponse()),
        stubImageMeta(meta),
      )

      const result = await p.fetch('mx-space/core')

      expect(result.thumbnailImage?.blurhash).toBe(meta.blurhash)
      expect(result.thumbnailImage?.palette).toEqual(meta.palette)
      expect(result.previewImage?.blurhash).toBe(meta.blurhash)
      expect(result.previewImage?.palette).toEqual(meta.palette)
      expect(result.previewImage?.width).toBe(1280)
      expect(result.previewImage?.height).toBe(640)
    })

    it('omits blurhash when ImageMetaService returns null', async () => {
      const p = new GitHubRepoProvider(
        createClient(makeRepoResponse()),
        stubImageMeta(null),
      )

      const result = await p.fetch('mx-space/core')

      expect(result.thumbnailImage?.url).toBe('https://avatar.url')
      expect(result.thumbnailImage?.blurhash).toBeUndefined()
      expect(result.thumbnailImage?.palette).toBeUndefined()
      expect(result.previewImage?.url).toMatch(/opengraph\.githubassets\.com/)
      expect(result.previewImage?.blurhash).toBeUndefined()
    })
  })
})
