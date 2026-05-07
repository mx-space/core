import { describe, expect, it, vi } from 'vitest'

import { EnrichmentService } from '~/modules/enrichment/enrichment.service'
import type {
  EnrichmentResult,
  EnrichmentRow,
} from '~/modules/enrichment/enrichment.types'

function makeResult(
  overrides: Partial<EnrichmentResult> = {},
): EnrichmentResult {
  return {
    title: 'Title',
    url: 'https://example.com',
    category: 'media',
    fetchedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  } as EnrichmentResult
}

function makeRow(overrides: Partial<EnrichmentRow> = {}): EnrichmentRow {
  return {
    id: '1',
    provider: 'tmdb',
    externalId: 'movie/1',
    url: 'https://www.themoviedb.org/movie/1',
    normalized: makeResult(),
    raw: null,
    fetchedAt: new Date(Date.now() - 25 * 3600 * 1000),
    expiresAt: new Date(Date.now() - 1000),
    failureCount: 0,
    lastError: null,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  }
}

interface ServiceStubs {
  dbRow?: EnrichmentRow | null
  redisHit?: EnrichmentResult | null
  fetchResult?: EnrichmentResult | Error
  imageMeta?:
    | {
        size: { width?: number; height?: number }
        accent: string
        blurHash: string
      }
    | Error
  configEnabled?: boolean
  match?: { id: string; subtype?: string; fullUrl: string } | null
}

function makeService(stubs: ServiceStubs = {}) {
  const repository = {
    findByProviderAndExternalId: vi.fn(async () => stubs.dbRow ?? null),
    upsert: vi.fn(async () => makeRow()),
  }
  const provider = {
    name: 'tmdb',
    category: 'media',
    defaultTtl: 86400,
    fetch: vi.fn(async () => {
      if (stubs.fetchResult instanceof Error) throw stubs.fetchResult
      return stubs.fetchResult ?? makeResult()
    }),
  }
  const providerRegistry = {
    match: vi.fn(() => {
      if (stubs.match === null) return null
      return {
        provider,
        match: stubs.match ?? {
          id: 'movie/1',
          subtype: 'movie',
          fullUrl: 'https://www.themoviedb.org/movie/1',
        },
      }
    }),
  }
  const configsService = {
    get: vi.fn(async () => ({})),
  }
  const redisClient = {
    get: vi.fn(async () =>
      stubs.redisHit ? JSON.stringify(stubs.redisHit) : null,
    ),
    set: vi.fn(async () => 'OK'),
    del: vi.fn(async () => 1),
  }
  const redisService = {
    getClient: () => redisClient,
  }
  const imageService = {
    getOnlineImageSizeAndMeta: vi.fn(async () => {
      if (stubs.imageMeta instanceof Error) throw stubs.imageMeta
      return (
        stubs.imageMeta ?? {
          size: { width: 500, height: 750 },
          accent: '#aabbcc',
          blurHash: 'L_blurhash_',
        }
      )
    }),
  }
  const taskQueueService = {
    createTask: vi.fn(async () => ({ taskId: 't1', created: true })),
  }
  const taskQueueProcessor = {
    registerHandler: vi.fn(),
  }

  const service = Object.create(EnrichmentService.prototype) as any
  service.repository = repository
  service.providerRegistry = providerRegistry
  service.configsService = configsService
  service.redisService = redisService
  service.imageService = imageService
  service.taskQueueService = taskQueueService
  service.taskQueueProcessor = taskQueueProcessor
  service.logger = { warn: vi.fn(), log: vi.fn() }

  return {
    service: service as EnrichmentService,
    repository,
    provider,
    redisClient,
    imageService,
    taskQueueService,
    taskQueueProcessor,
  }
}

describe('EnrichmentService.resolve (SWR)', () => {
  const url = 'https://www.themoviedb.org/movie/1'

  it('returns DB row immediately when not expired (no enqueue)', async () => {
    const dbRow = makeRow({ expiresAt: new Date(Date.now() + 3600_000) })
    const { service, taskQueueService, redisClient } = makeService({ dbRow })
    const out = await service.resolve(url)
    expect(out.result).toBe(dbRow.normalized)
    expect(out.stale).toBeUndefined()
    expect(redisClient.set).toHaveBeenCalled()
    expect(taskQueueService.createTask).not.toHaveBeenCalled()
  })

  it('returns expired DB row as stale and enqueues refresh (dedup key)', async () => {
    const dbRow = makeRow({ expiresAt: new Date(Date.now() - 1000) })
    const { service, taskQueueService, repository } = makeService({ dbRow })
    const out = await service.resolve(url)
    expect(out.result).toBe(dbRow.normalized)
    expect(out.stale).toBe(true)
    await new Promise((r) => setImmediate(r))
    expect(taskQueueService.createTask).toHaveBeenCalledTimes(1)
    expect(taskQueueService.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'enrichment:refresh',
        scope: 'enrichment',
        dedupKey: 'tmdb:movie/1',
        payload: { provider: 'tmdb', externalId: 'movie/1' },
      }),
    )
    // No upsert / no Redis set on stale path
    expect(repository.upsert).not.toHaveBeenCalled()
  })

  it('does NOT enqueue when expired but in failure backoff', async () => {
    const dbRow = makeRow({
      expiresAt: new Date(Date.now() - 1000),
      failureCount: 1,
      fetchedAt: new Date(Date.now() - 1000), // 60 * 2^1 = 120s backoff still active
    })
    const { service, taskQueueService } = makeService({ dbRow })
    const out = await service.resolve(url)
    expect(out.result).toBe(dbRow.normalized)
    expect(out.stale).toBe(true)
    await new Promise((r) => setImmediate(r))
    expect(taskQueueService.createTask).not.toHaveBeenCalled()
  })

  it('cold path: DB miss → fetch + enrichWithImageMeta + upsert', async () => {
    const fetchResult = makeResult({
      image: { url: 'https://image.tmdb.org/t/p/w500/poster.jpg' },
    })
    const { service, repository, imageService, provider } = makeService({
      dbRow: null,
      fetchResult,
    })
    const out = await service.resolve(url)
    expect(provider.fetch).toHaveBeenCalled()
    expect(imageService.getOnlineImageSizeAndMeta).toHaveBeenCalledWith(
      'https://image.tmdb.org/t/p/w500/poster.jpg',
    )
    expect(out.result.color).toBe('#aabbcc')
    expect(out.result.image?.blurhash).toBe('L_blurhash_')
    expect(out.result.image?.width).toBe(500)
    expect(out.result.image?.height).toBe(750)
    expect(repository.upsert).toHaveBeenCalled()
  })

  it('two consecutive expired resolves both enqueue (dedup is task-queue-side)', async () => {
    const dbRow = makeRow({ expiresAt: new Date(Date.now() - 1000) })
    const { service, taskQueueService } = makeService({ dbRow })
    await service.resolve(url)
    await service.resolve(url)
    await new Promise((r) => setImmediate(r))
    // Both calls hit createTask with the same dedupKey; the queue itself
    // collapses duplicates atomically.
    expect(taskQueueService.createTask).toHaveBeenCalledTimes(2)
    const calls = taskQueueService.createTask.mock.calls
    expect(calls[0][0].dedupKey).toBe('tmdb:movie/1')
    expect(calls[1][0].dedupKey).toBe('tmdb:movie/1')
  })
})

describe('EnrichmentService.enrichWithImageMeta', () => {
  it('populates color/blurhash/size when image.url present and color absent', async () => {
    const { service, imageService } = makeService()
    const result = makeResult({
      image: { url: 'https://example.com/p.jpg' },
    })
    await (service as any).enrichWithImageMeta(result)
    expect(imageService.getOnlineImageSizeAndMeta).toHaveBeenCalledTimes(1)
    expect(result.color).toBe('#aabbcc')
    expect(result.image?.blurhash).toBe('L_blurhash_')
    expect(result.image?.width).toBe(500)
    expect(result.image?.height).toBe(750)
  })

  it('skips when color is already set (e.g. github-repo language name)', async () => {
    const { service, imageService } = makeService()
    const result = makeResult({
      image: { url: 'https://example.com/p.jpg' },
      color: 'TypeScript',
    })
    await (service as any).enrichWithImageMeta(result)
    expect(imageService.getOnlineImageSizeAndMeta).not.toHaveBeenCalled()
    expect(result.color).toBe('TypeScript')
  })

  it('skips when image.url is absent', async () => {
    const { service, imageService } = makeService()
    const result = makeResult({})
    await (service as any).enrichWithImageMeta(result)
    expect(imageService.getOnlineImageSizeAndMeta).not.toHaveBeenCalled()
    expect(result.color).toBeUndefined()
  })

  it('swallows ImageService errors and logs a warning', async () => {
    const { service, imageService } = makeService({
      imageMeta: new Error('boom'),
    })
    const result = makeResult({
      image: { url: 'https://example.com/p.jpg' },
    })
    await expect(
      (service as any).enrichWithImageMeta(result),
    ).resolves.toBeUndefined()
    expect(imageService.getOnlineImageSizeAndMeta).toHaveBeenCalled()
    expect(result.color).toBeUndefined()
    expect((service as any).logger.warn).toHaveBeenCalled()
  })
})
