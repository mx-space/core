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
      findByProviderAndExternalId: vi.fn(
        async (provider: string, externalId: string) => {
          const key = `${provider}:${externalId}`
          return stubs.rows?.get(key) ?? null
        },
      ),
    }
    const service = Object.create(EnrichmentService.prototype) as any
    service.repository = repository
    service.matchUrlToRef = stubs.matchUrlToRef ?? (() => null)
    service.taskQueueService = stubs.taskQueueService ?? {
      createTask: vi.fn(async () => ({ taskId: 't1', created: true })),
    }
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
        type: 'enrichment-refresh',
        dedupKey: 'gh-repo:vercel/next.js',
        payload: { provider: 'gh-repo', externalId: 'vercel/next.js' },
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
    const repoSpy = vi.fn(async () => row)
    const svc = makeService({
      matchUrlToRef: () => ({
        provider: 'gh-repo',
        externalId: 'vercel/next.js',
      }),
    }) as any
    svc.repository = { findByProviderAndExternalId: repoSpy }
    await svc.hydrateUrls([url, url, url])
    expect(repoSpy).toHaveBeenCalledTimes(1)
  })
})
