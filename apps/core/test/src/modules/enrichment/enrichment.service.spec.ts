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
    locale: '',
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
    localeAware: false as boolean,
    supportedLocales: undefined as readonly string[] | undefined,
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
        payload: { provider: 'tmdb', externalId: 'movie/1', locale: '' },
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

describe('EnrichmentService.resolveCacheLocale', () => {
  it('returns "" for non-locale-aware providers regardless of input', () => {
    const { service } = makeService()
    const provider = { localeAware: false } as any
    expect(service.resolveCacheLocale(provider, 'zh')).toBe('')
    expect(service.resolveCacheLocale(provider, undefined)).toBe('')
  })

  it('returns the locale when locale-aware provider supports it', () => {
    const { service } = makeService()
    const provider = {
      localeAware: true,
      supportedLocales: ['zh', 'ja', 'ko', 'en'],
    } as any
    expect(service.resolveCacheLocale(provider, 'zh')).toBe('zh')
    expect(service.resolveCacheLocale(provider, 'ja')).toBe('ja')
  })

  it('falls back to "" when requested locale is unsupported', () => {
    const { service } = makeService()
    const provider = {
      localeAware: true,
      supportedLocales: ['zh', 'ja'],
    } as any
    expect(service.resolveCacheLocale(provider, 'fr')).toBe('')
  })

  it('falls back to "" when no requested locale', () => {
    const { service } = makeService()
    const provider = {
      localeAware: true,
      supportedLocales: ['zh'],
    } as any
    expect(service.resolveCacheLocale(provider, undefined)).toBe('')
  })
})

describe('EnrichmentService.resolve (locale)', () => {
  const url = 'https://www.themoviedb.org/movie/1'

  function makeLocaleAwareService(stubs: ServiceStubs = {}) {
    const ctx = makeService(stubs)
    ;(ctx.provider as any).localeAware = true
    ;(ctx.provider as any).supportedLocales = ['zh', 'ja', 'ko', 'en']
    return ctx
  }

  it('looks up by request locale when supported', async () => {
    const dbRow = makeRow({
      locale: 'zh',
      expiresAt: new Date(Date.now() + 3600_000),
    })
    const { service, repository } = makeLocaleAwareService({ dbRow })
    const out = await service.resolve(url, 'zh')
    expect(out.result).toBe(dbRow.normalized)
    expect(repository.findByProviderAndExternalId).toHaveBeenCalledWith(
      'tmdb',
      'movie/1',
      'zh',
    )
  })

  it('falls back to empty-locale row when locale row missing, then enqueues real fetch', async () => {
    const fallbackRow = makeRow({
      locale: '',
      expiresAt: new Date(Date.now() + 3600_000),
    })
    const repository = {
      findByProviderAndExternalId: vi
        .fn()
        // first call: zh row missing
        .mockResolvedValueOnce(null)
        // second call: '' fallback
        .mockResolvedValueOnce(fallbackRow),
      upsert: vi.fn(async () => makeRow({ locale: 'zh' })),
    }
    const { service, taskQueueService } = makeLocaleAwareService()
    ;(service as any).repository = repository
    const out = await service.resolve(url, 'zh')
    expect(out.result).toBe(fallbackRow.normalized)
    expect(out.stale).toBe(true)
    expect(repository.findByProviderAndExternalId).toHaveBeenCalledTimes(2)
    expect(repository.findByProviderAndExternalId).toHaveBeenNthCalledWith(
      1,
      'tmdb',
      'movie/1',
      'zh',
    )
    expect(repository.findByProviderAndExternalId).toHaveBeenNthCalledWith(
      2,
      'tmdb',
      'movie/1',
      '',
    )
    await new Promise((r) => setImmediate(r))
    expect(taskQueueService.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupKey: 'tmdb:movie/1:zh',
        payload: { provider: 'tmdb', externalId: 'movie/1', locale: 'zh' },
      }),
    )
  })

  it('cold-fetches with locale when no fallback row exists', async () => {
    const { service, provider, repository } = makeLocaleAwareService({
      dbRow: null,
    })
    await service.resolve(url, 'zh')
    expect(provider.fetch).toHaveBeenCalledWith('movie/1', 'zh')
    expect(repository.upsert).toHaveBeenCalled()
    const upsertArgs = repository.upsert.mock.calls[0]
    // upsert(provider, externalId, url, normalized, raw, expiresAt, locale)
    expect(upsertArgs[6]).toBe('zh')
  })

  it('non-locale-aware provider ignores lang and uses ""', async () => {
    const { service, provider, repository } = makeService({ dbRow: null })
    await service.resolve(url, 'zh')
    // fetch receives undefined locale because cacheLocale='' → fetch(id, undefined)
    expect(provider.fetch).toHaveBeenCalledWith('movie/1', undefined)
    expect(repository.upsert.mock.calls[0][6]).toBe('')
  })

  it('unsupported locale falls back to "" cache for locale-aware provider', async () => {
    const dbRow = makeRow({
      locale: '',
      expiresAt: new Date(Date.now() + 3600_000),
    })
    const { service, repository } = makeLocaleAwareService({ dbRow })
    await service.resolve(url, 'fr')
    expect(repository.findByProviderAndExternalId).toHaveBeenCalledWith(
      'tmdb',
      'movie/1',
      '',
    )
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
