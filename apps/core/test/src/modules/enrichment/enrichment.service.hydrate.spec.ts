import { describe, expect, it, vi } from 'vitest'

import { EnrichmentService } from '~/modules/enrichment/enrichment.service'
import type {
  EnrichmentResult,
  EnrichmentRow,
} from '~/modules/enrichment/enrichment.types'

function makeRow(overrides: Partial<EnrichmentRow>): EnrichmentRow {
  const result: EnrichmentResult = {
    title: overrides.normalized?.title ?? 'Title',
    url: overrides.url ?? 'https://example.com',
    category: overrides.normalized?.category ?? 'developer',
    fetchedAt: '2026-01-01T00:00:00Z',
    ...overrides.normalized,
  } as EnrichmentResult
  return {
    id: '1',
    provider: 'gh-repo',
    externalId: 'vercel/next.js',
    url: 'https://github.com/vercel/next.js',
    locale: '',
    normalized: result,
    raw: null,
    fetchedAt: new Date('2026-01-01'),
    expiresAt: null,
    failureCount: 0,
    lastError: null,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  }
}

describe('EnrichmentService.hydrateUrls', () => {
  function makeService(stubs: {
    matchUrlToRef?: (
      url: string,
    ) => { provider: string; externalId: string } | null
    rows?: Map<string, EnrichmentRow>
    taskQueueService?: { createTask: ReturnType<typeof vi.fn> }
  }) {
    const repository = {
      findManyByRefs: vi.fn(
        async (
          refs: {
            provider: string
            externalId: string
            locale?: string
          }[],
        ) => {
          const out: EnrichmentRow[] = []
          for (const ref of refs) {
            const key = `${ref.provider}:${ref.externalId}`
            const row = stubs.rows?.get(key)
            if (row && (ref.locale ?? '') === (row.locale ?? '')) out.push(row)
          }
          return out
        },
      ),
    }
    const service = Object.create(EnrichmentService.prototype) as any
    service.repository = repository
    service.matchUrlToRef = stubs.matchUrlToRef ?? (() => null)
    service.taskQueueService = stubs.taskQueueService ?? {
      createTask: vi.fn(async () => ({ taskId: 't1', created: true })),
    }
    // Cache-miss enqueue path checks provider readiness; default stubs
    // skip the path so existing tests keep their original assertions.
    service.providerRegistry = { getByName: () => undefined }
    service.configsService = { get: async () => ({}) }
    service.logger = { warn: vi.fn() }
    return service as EnrichmentService
  }

  it('returns empty map for empty input', async () => {
    const svc = makeService({})
    expect(await svc.hydrateUrls([])).toEqual({})
  })

  it('skips URLs with no matching provider', async () => {
    const svc = makeService({
      matchUrlToRef: () => null,
    })
    expect(await svc.hydrateUrls(['https://nope.example.com'])).toEqual({})
  })

  it('skips URLs that match a provider but have no cached row', async () => {
    const svc = makeService({
      matchUrlToRef: () => ({ provider: 'gh-repo', externalId: 'a/b' }),
      rows: new Map(),
    })
    expect(await svc.hydrateUrls(['https://github.com/a/b'])).toEqual({})
  })

  it('returns the cached normalized result keyed by original URL', async () => {
    const url = 'https://github.com/vercel/next.js'
    const row = makeRow({
      normalized: { title: 'Next.js' } as EnrichmentResult,
    })
    const svc = makeService({
      matchUrlToRef: () => ({
        provider: 'gh-repo',
        externalId: 'vercel/next.js',
      }),
      rows: new Map([['gh-repo:vercel/next.js', row]]),
    })
    const result = await svc.hydrateUrls([url])
    expect(result[url]?.title).toBe('Next.js')
  })

  it('returns expired rows and enqueues a refresh task', async () => {
    const url = 'https://github.com/vercel/next.js'
    const row = makeRow({
      expiresAt: new Date(Date.now() - 1000),
    })
    const taskQueueService = {
      createTask: vi.fn(async () => ({ taskId: 't1', created: true })),
    }
    const svc = makeService({
      matchUrlToRef: () => ({
        provider: 'gh-repo',
        externalId: 'vercel/next.js',
      }),
      rows: new Map([['gh-repo:vercel/next.js', row]]),
      taskQueueService,
    })

    const result = await svc.hydrateUrls([url])
    expect(result[url]).toBeDefined()
    // wait a tick for fire-and-forget enqueue
    await new Promise((r) => setImmediate(r))
    expect(taskQueueService.createTask).toHaveBeenCalledTimes(1)
    expect(taskQueueService.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'enrichment:refresh',
        dedupKey: 'gh-repo:vercel/next.js',
        payload: {
          provider: 'gh-repo',
          externalId: 'vercel/next.js',
          locale: '',
        },
      }),
    )
  })

  it('does not enqueue refresh for expired rows in failure backoff', async () => {
    const url = 'https://github.com/vercel/next.js'
    const row = makeRow({
      expiresAt: new Date(Date.now() - 1000),
      failureCount: 1,
      // backoff = 60 * 2^1 = 120s. fetchedAt now → still in backoff.
      fetchedAt: new Date(Date.now() - 1000),
    })
    const taskQueueService = {
      createTask: vi.fn(async () => ({ taskId: 't1', created: true })),
    }
    const svc = makeService({
      matchUrlToRef: () => ({
        provider: 'gh-repo',
        externalId: 'vercel/next.js',
      }),
      rows: new Map([['gh-repo:vercel/next.js', row]]),
      taskQueueService,
    })

    const result = await svc.hydrateUrls([url])
    expect(result[url]).toBeDefined()
    await new Promise((r) => setImmediate(r))
    expect(taskQueueService.createTask).not.toHaveBeenCalled()
  })

  it('keeps rows with no expiresAt', async () => {
    const url = 'https://github.com/vercel/next.js'
    const row = makeRow({ expiresAt: null })
    const svc = makeService({
      matchUrlToRef: () => ({
        provider: 'gh-repo',
        externalId: 'vercel/next.js',
      }),
      rows: new Map([['gh-repo:vercel/next.js', row]]),
    })
    const result = await svc.hydrateUrls([url])
    expect(result[url]).toBeDefined()
  })

  it('dedupes the same URL appearing twice', async () => {
    const url = 'https://github.com/vercel/next.js'
    const row = makeRow({})
    const repoSpy = vi.fn(async () => [row])
    const svc = makeService({
      matchUrlToRef: () => ({
        provider: 'gh-repo',
        externalId: 'vercel/next.js',
      }),
    }) as any
    svc.repository = { findManyByRefs: repoSpy }
    await svc.hydrateUrls([url, url, url])
    expect(repoSpy).toHaveBeenCalledTimes(1)
    expect(repoSpy).toHaveBeenCalledWith([
      { provider: 'gh-repo', externalId: 'vercel/next.js', locale: '' },
    ])
  })

  it('locale-aware fallback: missing zh row + present "" row → "" is returned', async () => {
    const url = 'https://www.themoviedb.org/movie/1'
    const fallbackRow = makeRow({
      provider: 'tmdb',
      externalId: 'movie/1',
      url,
      locale: '',
      normalized: { title: 'Default' } as EnrichmentResult,
    })

    const repository = {
      // First call: zh refs → empty. Second call: '' fallback refs → fallback.
      findManyByRefs: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([fallbackRow]),
    }
    const taskQueueService = {
      createTask: vi.fn(async () => ({ taskId: 't1', created: true })),
    }

    const service = Object.create(EnrichmentService.prototype) as any
    service.repository = repository
    service.matchUrlToRef = () => ({ provider: 'tmdb', externalId: 'movie/1' })
    service.taskQueueService = taskQueueService
    service.providerRegistry = {
      getByName: () => ({
        name: 'tmdb',
        localeAware: true,
        supportedLocales: ['zh', 'ja'],
        featureGateConfigKey: undefined,
      }),
    }
    service.configsService = { get: async () => ({}) }
    service.logger = { warn: vi.fn() }

    const result = await service.hydrateUrls([url], 'zh')
    expect(result[url]).toBe(fallbackRow.normalized)
    expect(repository.findManyByRefs).toHaveBeenCalledTimes(2)
    expect(repository.findManyByRefs).toHaveBeenNthCalledWith(1, [
      { provider: 'tmdb', externalId: 'movie/1', locale: 'zh' },
    ])
    expect(repository.findManyByRefs).toHaveBeenNthCalledWith(2, [
      { provider: 'tmdb', externalId: 'movie/1', locale: '' },
    ])
    await new Promise((r) => setImmediate(r))
    expect(taskQueueService.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupKey: 'tmdb:movie/1:zh',
        payload: { provider: 'tmdb', externalId: 'movie/1', locale: 'zh' },
      }),
    )
  })

  it('non-locale-aware provider ignores lang and looks up "" row', async () => {
    const url = 'https://github.com/vercel/next.js'
    const row = makeRow({})
    const repository = {
      findManyByRefs: vi.fn(async () => [row]),
    }
    const service = Object.create(EnrichmentService.prototype) as any
    service.repository = repository
    service.matchUrlToRef = () => ({
      provider: 'gh-repo',
      externalId: 'vercel/next.js',
    })
    service.taskQueueService = {
      createTask: vi.fn(async () => ({ taskId: 't1', created: true })),
    }
    service.providerRegistry = {
      getByName: () => ({ name: 'gh-repo', localeAware: false }),
    }
    service.configsService = { get: async () => ({}) }
    service.logger = { warn: vi.fn() }

    await service.hydrateUrls([url], 'zh')
    expect(repository.findManyByRefs).toHaveBeenCalledWith([
      { provider: 'gh-repo', externalId: 'vercel/next.js', locale: '' },
    ])
  })
})
