import { describe, expect, it, vi } from 'vitest'

import {
  EnrichmentService,
  refKey,
} from '~/modules/enrichment/enrichment.service'
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

function makeService(stubs: {
  rows?: Map<string, EnrichmentRow>
  taskQueueService?: { createTask: ReturnType<typeof vi.fn> }
  providerRegistry?: any
}) {
  const repository = {
    findManyByRefs: vi.fn(
      async (
        refs: { provider: string; externalId: string; locale?: string }[],
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
  service.taskQueueService = stubs.taskQueueService ?? {
    createTask: vi.fn(async () => ({ taskId: 't1', created: true })),
  }
  service.providerRegistry = stubs.providerRegistry ?? {
    getByName: () => undefined,
  }
  service.configsService = { get: async () => ({}) }
  service.logger = { warn: vi.fn() }
  return { service: service as EnrichmentService, repository }
}

describe('EnrichmentService.hydrateRefs', () => {
  it('returns {} for empty input', async () => {
    const { service } = makeService({})
    expect(await service.hydrateRefs([])).toEqual({})
  })

  it('returns cached normalized result keyed by refKey', async () => {
    const row = makeRow({
      normalized: { title: 'Next.js' } as EnrichmentResult,
    })
    const { service } = makeService({
      rows: new Map([['gh-repo:vercel/next.js', row]]),
    })
    const out = await service.hydrateRefs([
      { provider: 'gh-repo', externalId: 'vercel/next.js' },
    ])
    expect(out[refKey('gh-repo', 'vercel/next.js')]?.title).toBe('Next.js')
  })

  it('dedupes identical refs in input', async () => {
    const row = makeRow({})
    const { service, repository } = makeService({
      rows: new Map([['gh-repo:vercel/next.js', row]]),
    })
    await service.hydrateRefs([
      { provider: 'gh-repo', externalId: 'vercel/next.js' },
      { provider: 'gh-repo', externalId: 'vercel/next.js' },
      { provider: 'gh-repo', externalId: 'vercel/next.js' },
    ])
    expect(repository.findManyByRefs).toHaveBeenCalledTimes(1)
    expect(repository.findManyByRefs).toHaveBeenCalledWith([
      { provider: 'gh-repo', externalId: 'vercel/next.js', locale: '' },
    ])
  })

  it('enqueues refresh for expired non-backoff rows', async () => {
    const row = makeRow({ expiresAt: new Date(Date.now() - 1000) })
    const taskQueueService = {
      createTask: vi.fn(async () => ({ taskId: 't1', created: true })),
    }
    const { service } = makeService({
      rows: new Map([['gh-repo:vercel/next.js', row]]),
      taskQueueService,
    })
    const out = await service.hydrateRefs([
      { provider: 'gh-repo', externalId: 'vercel/next.js' },
    ])
    expect(out[refKey('gh-repo', 'vercel/next.js')]).toBeDefined()
    await new Promise((r) => setImmediate(r))
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

  it('locale-aware fallback: zh miss + "" hit returns "" row and enqueues zh refresh', async () => {
    const fallbackRow = makeRow({
      provider: 'tmdb',
      externalId: 'movie/1',
      url: 'https://www.themoviedb.org/movie/1',
      locale: '',
      normalized: { title: 'Default' } as EnrichmentResult,
    })
    const repository = {
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
    service.taskQueueService = taskQueueService
    service.providerRegistry = {
      getByName: () => ({
        name: 'tmdb',
        localeAware: true,
        supportedLocales: ['zh', 'ja'],
      }),
    }
    service.configsService = { get: async () => ({}) }
    service.logger = { warn: vi.fn() }

    const out = await (service as EnrichmentService).hydrateRefs(
      [{ provider: 'tmdb', externalId: 'movie/1' }],
      'zh',
    )
    expect(out[refKey('tmdb', 'movie/1')]).toBe(fallbackRow.normalized)
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

  it('skips fallback DB read when no entries are locale-aware', async () => {
    const { service, repository } = makeService({
      rows: new Map(),
    })
    await service.hydrateRefs([{ provider: 'gh-repo', externalId: 'a/b' }])
    expect(repository.findManyByRefs).toHaveBeenCalledTimes(1)
  })
})
