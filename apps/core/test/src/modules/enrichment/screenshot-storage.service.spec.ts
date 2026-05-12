import { Logger } from '@nestjs/common'
import {
  createPgTestDatabase,
  type PgTestDatabase,
} from 'test/helper/pg-verify-url'

import { enrichmentCache, enrichmentScreenshots } from '~/database/schema'
import { EnrichmentScreenshotRepository } from '~/modules/enrichment/enrichment-screenshot.repository'
import type { ProcessedScreenshot } from '~/modules/enrichment/providers/open-graph/screenshot-pipeline.service'
import { ScreenshotStorageService } from '~/modules/enrichment/providers/open-graph/screenshot-storage.service'
import { SnowflakeGenerator } from '~/shared/id/snowflake.service'
import type { S3Uploader } from '~/utils/s3.util'

/**
 * In-memory fake of {@link S3Uploader} sufficient to exercise the storage
 * service. We type-assert via `as unknown as S3Uploader` so the service can
 * accept the fake without needing to implement every method on the real class.
 */
class FakeS3Uploader {
  public objects = new Map<string, Buffer>()
  public putCalls: Array<{ key: string; contentType: string; bytes: number }> =
    []
  public deleteCalls: string[] = []
  /** When set, the next `uploadBuffer` throws this error then clears it. */
  public nextUploadError: Error | null = null
  /** When set, every `deleteObject` for matching key throws. */
  public deleteFailKeys = new Set<string>()

  async uploadBuffer(
    buffer: Buffer,
    objectKey: string,
    contentType: string,
  ): Promise<string> {
    this.putCalls.push({
      key: objectKey,
      contentType,
      bytes: buffer.length,
    })
    if (this.nextUploadError) {
      const err = this.nextUploadError
      this.nextUploadError = null
      throw err
    }
    this.objects.set(objectKey, buffer)
    return this.getPublicUrl(objectKey)
  }

  async deleteObject(objectKey: string): Promise<void> {
    this.deleteCalls.push(objectKey)
    if (this.deleteFailKeys.has(objectKey)) {
      throw new Error(`fake S3: delete failure for ${objectKey}`)
    }
    this.objects.delete(objectKey)
  }

  getPublicUrl(objectKey: string): string {
    return `https://cdn.example.test/${objectKey}`
  }
}

/**
 * Subclass that injects a controllable fake S3 client and lets us swap the
 * Redis facade per-test without spinning up a real client.
 */
class TestScreenshotStorageService extends ScreenshotStorageService {
  public readonly fakeS3 = new FakeS3Uploader()

  protected override async getUploader(): Promise<S3Uploader> {
    return this.fakeS3 as unknown as S3Uploader
  }
}

function makeProcessed(
  overrides: Partial<ProcessedScreenshot> = {},
): ProcessedScreenshot {
  return {
    webp: Buffer.alloc(1024, 0xab),
    width: 1280,
    height: 720,
    blurhash: 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH',
    palette: { dominant: '#112233' },
    ...overrides,
  }
}

interface RedisFakeOptions {
  setResults?: Array<'OK' | null>
  setThrows?: boolean
}

function makeRedisService(opts: RedisFakeOptions = {}) {
  const setResults = [...(opts.setResults ?? ['OK'])]
  const setMock = vi.fn(async () => {
    if (opts.setThrows) throw new Error('fake redis: SET failure')
    // Default to 'OK' (first NX-acquire wins) when the queue is exhausted.
    if (setResults.length === 0) return 'OK'
    return setResults.shift() as 'OK' | null
  })
  const client = { set: setMock }
  return {
    setMock,
    redisService: { getClient: () => client } as any,
  }
}

function makeConfigsService(overrides?: {
  maxItems?: number
  maxTotalBytes?: number
  maxBytesPerImage?: number
  webpQuality?: number
  imageStorage?: Record<string, unknown>
}) {
  const screenshot = {
    enabled: true,
    maxItems: overrides?.maxItems ?? 500,
    maxTotalBytes: overrides?.maxTotalBytes ?? 100 * 1024 * 1024,
    maxBytesPerImage: overrides?.maxBytesPerImage ?? 512 * 1024,
    webpQuality: overrides?.webpQuality ?? 75,
  }
  const get = vi.fn(async (key: string) => {
    if (key === 'thirdPartyServiceIntegration') {
      return { openGraph: { screenshot } }
    }
    if (key === 'imageStorageOptions') {
      return {
        enable: true,
        endpoint: 'https://s3.example.test',
        secretId: 'AKIATESTKEY',
        secretKey: 'TESTSECRET',
        bucket: 'mx-test',
        region: 'auto',
        customDomain: '',
        ...overrides?.imageStorage,
      }
    }
    return {}
  })
  return { get } as any
}

const generator = new SnowflakeGenerator({ workerId: 23 })

async function seedEnrichment(
  ctx: PgTestDatabase,
  id: string,
  url = `https://example.test/${id}`,
) {
  await ctx.db.insert(enrichmentCache).values({
    id,
    provider: 'open-graph',
    externalId: `og:test:${id}`,
    url,
    normalized: { title: 'probe' } as Record<string, unknown>,
    raw: null,
  })
}

/**
 * Stamp a deterministic `last_accessed_at` on an existing screenshot row.
 * Avoids `setTimeout`-based ordering, which is fragile under CI load.
 */
async function stampAccessTime(
  ctx: PgTestDatabase,
  enrichmentId: string,
  iso: string,
) {
  await ctx.pool.query(
    `update enrichment_screenshots set last_accessed_at = $1 where enrichment_id = $2`,
    [iso, enrichmentId],
  )
}

describe('ScreenshotStorageService', () => {
  let context: PgTestDatabase
  let repository: EnrichmentScreenshotRepository

  beforeAll(async () => {
    context = await createPgTestDatabase('mx_screenshot_storage')
    repository = new EnrichmentScreenshotRepository(context.db as any)
  }, 60_000)

  afterAll(async () => {
    if (context) await context.close()
  })

  beforeEach(async () => {
    // Truncate both tables so each test starts on a clean slate (CASCADE
    // removes screenshots first via the FK).
    await context.pool.query('TRUNCATE enrichment_cache CASCADE')
  })

  afterEach(() => {
    // Restore any vi.spyOn applied to the shared repository so the next
    // test starts from a clean prototype.
    vi.restoreAllMocks()
  })

  it('uploads to S3 and inserts a row on happy path', async () => {
    const id = generator.nextId()
    await seedEnrichment(context, id)
    const processed = makeProcessed({ webp: Buffer.alloc(2048, 1) })
    const { redisService } = makeRedisService()
    const service = new TestScreenshotStorageService(
      repository,
      makeConfigsService(),
      redisService,
    )

    const result = await service.storeOrEvict({
      enrichmentId: id,
      processed,
    })

    expect(result.objectKey).toBe(`enrichment-screenshots/${id}.webp`)
    expect(result.bytes).toBe(2048)
    expect(result.url).toBe(
      `https://cdn.example.test/enrichment-screenshots/${id}.webp`,
    )
    expect(service.fakeS3.putCalls).toHaveLength(1)
    expect(service.fakeS3.putCalls[0]).toMatchObject({
      key: `enrichment-screenshots/${id}.webp`,
      contentType: 'image/webp',
      bytes: 2048,
    })

    const row = await repository.findByEnrichmentId(id)
    expect(row).not.toBeNull()
    expect(row?.bytes).toBe(2048)
    expect(row?.palette).toEqual({ dominant: '#112233' })
  })

  it('overwrites the existing row on re-capture (upsert)', async () => {
    const id = generator.nextId()
    await seedEnrichment(context, id)
    const { redisService } = makeRedisService()
    const service = new TestScreenshotStorageService(
      repository,
      makeConfigsService(),
      redisService,
    )

    await service.storeOrEvict({
      enrichmentId: id,
      processed: makeProcessed({
        webp: Buffer.alloc(1024, 1),
        palette: { dominant: '#aabbcc' },
      }),
    })
    await service.storeOrEvict({
      enrichmentId: id,
      processed: makeProcessed({
        webp: Buffer.alloc(3072, 2),
        palette: { dominant: '#001122', swatches: ['#334455'] },
      }),
    })

    // Both writes target the same object key — S3 overwrites, no delete.
    expect(service.fakeS3.deleteCalls).toEqual([])
    expect(service.fakeS3.putCalls).toHaveLength(2)
    expect(
      service.fakeS3.objects.get(`enrichment-screenshots/${id}.webp`)?.length,
    ).toBe(3072)

    const row = await repository.findByEnrichmentId(id)
    expect(row?.bytes).toBe(3072)
    expect(row?.palette).toEqual({
      dominant: '#001122',
      swatches: ['#334455'],
    })
  })

  it('evicts oldest by item-cap before storing a new screenshot', async () => {
    const ids = [generator.nextId(), generator.nextId(), generator.nextId()]
    for (const id of ids) await seedEnrichment(context, id)

    const { redisService } = makeRedisService()
    const service = new TestScreenshotStorageService(
      repository,
      makeConfigsService({ maxItems: 2 }),
      redisService,
    )

    // Seed the first two with deterministic `last_accessed_at` so the
    // eviction order is well-defined: ids[0] is the oldest.
    await service.storeOrEvict({
      enrichmentId: ids[0],
      processed: makeProcessed({ webp: Buffer.alloc(1024, 1) }),
    })
    await stampAccessTime(context, ids[0], '2020-01-01T00:00:00Z')
    await service.storeOrEvict({
      enrichmentId: ids[1],
      processed: makeProcessed({ webp: Buffer.alloc(1024, 2) }),
    })
    await stampAccessTime(context, ids[1], '2020-01-02T00:00:00Z')

    expect(service.fakeS3.deleteCalls).toEqual([])

    // Third write must evict ids[0] (the oldest).
    await service.storeOrEvict({
      enrichmentId: ids[2],
      processed: makeProcessed({ webp: Buffer.alloc(1024, 3) }),
    })

    expect(service.fakeS3.deleteCalls).toEqual([
      `enrichment-screenshots/${ids[0]}.webp`,
    ])
    expect(await repository.findByEnrichmentId(ids[0])).toBeNull()
    expect(await repository.findByEnrichmentId(ids[1])).not.toBeNull()
    expect(await repository.findByEnrichmentId(ids[2])).not.toBeNull()
  })

  it('evicts oldest by byte-cap when count is under the item limit', async () => {
    const ids = [generator.nextId(), generator.nextId(), generator.nextId()]
    for (const id of ids) await seedEnrichment(context, id)

    const { redisService } = makeRedisService()
    // maxItems plenty large, but bytes cap tight — 3000 bytes total,
    // each row is 1500 bytes, so the third write needs eviction.
    const service = new TestScreenshotStorageService(
      repository,
      makeConfigsService({ maxItems: 100, maxTotalBytes: 3000 }),
      redisService,
    )

    await service.storeOrEvict({
      enrichmentId: ids[0],
      processed: makeProcessed({ webp: Buffer.alloc(1500, 1) }),
    })
    await stampAccessTime(context, ids[0], '2020-01-01T00:00:00Z')
    await service.storeOrEvict({
      enrichmentId: ids[1],
      processed: makeProcessed({ webp: Buffer.alloc(1500, 2) }),
    })
    await stampAccessTime(context, ids[1], '2020-01-02T00:00:00Z')
    await service.storeOrEvict({
      enrichmentId: ids[2],
      processed: makeProcessed({ webp: Buffer.alloc(1500, 3) }),
    })

    expect(service.fakeS3.deleteCalls).toContain(
      `enrichment-screenshots/${ids[0]}.webp`,
    )
    expect(await repository.findByEnrichmentId(ids[0])).toBeNull()
    expect(await repository.findByEnrichmentId(ids[1])).not.toBeNull()
    expect(await repository.findByEnrichmentId(ids[2])).not.toBeNull()
  })

  it('aborts the batch and does NOT insert when DB delete fails during eviction', async () => {
    const ids = [generator.nextId(), generator.nextId()]
    for (const id of ids) await seedEnrichment(context, id)

    const { redisService } = makeRedisService()
    const service = new TestScreenshotStorageService(
      repository,
      makeConfigsService({ maxItems: 1 }),
      redisService,
    )

    await service.storeOrEvict({
      enrichmentId: ids[0],
      processed: makeProcessed({ webp: Buffer.alloc(1024, 1) }),
    })

    // Mock the repo's deleteByEnrichmentId to fail when called for eviction.
    const origDelete = repository.deleteByEnrichmentId.bind(repository)
    const failingDelete = vi
      .spyOn(repository, 'deleteByEnrichmentId')
      .mockImplementation(async () => {
        throw new Error('simulated DB delete failure')
      })

    await expect(
      service.storeOrEvict({
        enrichmentId: ids[1],
        processed: makeProcessed({ webp: Buffer.alloc(1024, 2) }),
      }),
    ).rejects.toThrow(/aborted batch/)

    // The new row must NOT have been inserted.
    failingDelete.mockRestore()
    expect(await repository.findByEnrichmentId(ids[1])).toBeNull()

    // We abort BEFORE the S3 put for the new id, so its object never appears.
    expect(
      service.fakeS3.objects.has(`enrichment-screenshots/${ids[1]}.webp`),
    ).toBe(false)

    // Restore repository state for subsequent tests.
    await origDelete(ids[0]).catch(() => undefined)
  })

  it('delete removes the row and calls S3 deleteObject', async () => {
    const id = generator.nextId()
    await seedEnrichment(context, id)
    const { redisService } = makeRedisService()
    const service = new TestScreenshotStorageService(
      repository,
      makeConfigsService(),
      redisService,
    )

    await service.storeOrEvict({
      enrichmentId: id,
      processed: makeProcessed({ webp: Buffer.alloc(1024, 7) }),
    })

    await service.delete(id)

    expect(service.fakeS3.deleteCalls).toContain(
      `enrichment-screenshots/${id}.webp`,
    )
    expect(await repository.findByEnrichmentId(id)).toBeNull()
  })

  it('delete is a no-op when the row is missing', async () => {
    const id = generator.nextId()
    const { redisService } = makeRedisService()
    const service = new TestScreenshotStorageService(
      repository,
      makeConfigsService(),
      redisService,
    )

    await expect(service.delete(id)).resolves.toBeUndefined()
    expect(service.fakeS3.deleteCalls).toHaveLength(0)
  })

  it('delete() proceeds with DB delete even if S3 delete fails', async () => {
    const id = generator.nextId()
    await seedEnrichment(context, id)
    const { redisService } = makeRedisService()
    const service = new TestScreenshotStorageService(
      repository,
      makeConfigsService(),
      redisService,
    )

    await service.storeOrEvict({
      enrichmentId: id,
      processed: makeProcessed({ webp: Buffer.alloc(1024, 9) }),
    })

    // Force the next S3 delete for this object key to fail.
    const objectKey = `enrichment-screenshots/${id}.webp`
    service.fakeS3.deleteFailKeys.add(objectKey)

    const warnSpy = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined)

    await expect(service.delete(id)).resolves.toBeUndefined()

    expect(service.fakeS3.deleteCalls).toContain(objectKey)
    expect(await repository.findByEnrichmentId(id)).toBeNull()
    expect(warnSpy).toHaveBeenCalled()
    const warnedMessage = warnSpy.mock.calls.map((c) => String(c[0])).join('\n')
    expect(warnedMessage).toContain(objectKey)
  })

  it('touchAccess updates the DB only on the first Redis NX win', async () => {
    const id = generator.nextId()
    await seedEnrichment(context, id)
    await context.db.insert(enrichmentScreenshots).values({
      enrichmentId: id,
      objectKey: `enrichment-screenshots/${id}.webp`,
      bytes: 1024,
      width: 1280,
      height: 720,
      blurhash: null,
      palette: null,
    })

    // First SET wins, second returns null (key already exists).
    const { redisService, setMock } = makeRedisService({
      setResults: ['OK', null],
    })

    const touchSpy = vi.spyOn(repository, 'touchAccess')
    const service = new TestScreenshotStorageService(
      repository,
      makeConfigsService(),
      redisService,
    )

    await service.touchAccess(id)
    await service.touchAccess(id)

    expect(setMock).toHaveBeenCalledTimes(2)
    // Lock in the throttle contract: TTL 3600s + NX mode + value '1'. The
    // key is built via `getRedisKey` so it includes the env prefix; assert
    // it contains the enrichment id and the typed segment.
    expect(setMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining(`enrichment_screenshot_touch:${id}`),
      '1',
      'EX',
      3600,
      'NX',
    )
    expect(touchSpy).toHaveBeenCalledTimes(1)
    expect(touchSpy).toHaveBeenCalledWith(id)
    touchSpy.mockRestore()
  })

  it('touchAccess swallows Redis errors and skips the DB update', async () => {
    const id = generator.nextId()
    const { redisService, setMock } = makeRedisService({ setThrows: true })
    const touchSpy = vi.spyOn(repository, 'touchAccess')
    const service = new TestScreenshotStorageService(
      repository,
      makeConfigsService(),
      redisService,
    )

    await expect(service.touchAccess(id)).resolves.toBeUndefined()
    expect(setMock).toHaveBeenCalledTimes(1)
    expect(touchSpy).not.toHaveBeenCalled()
    touchSpy.mockRestore()
  })
})
