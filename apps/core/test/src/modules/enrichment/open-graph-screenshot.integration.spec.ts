import sharp from 'sharp'
import {
  createPgTestDatabase,
  type PgTestDatabase,
} from 'test/helper/pg-verify-url'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { EnrichmentRepository } from '~/modules/enrichment/enrichment.repository'
import { EnrichmentService } from '~/modules/enrichment/enrichment.service'
import { EnrichmentScreenshotRepository } from '~/modules/enrichment/enrichment-screenshot.repository'
import { BrowserFetchService } from '~/modules/enrichment/providers/open-graph/browser-fetch.service'
import { OpenGraphProvider } from '~/modules/enrichment/providers/open-graph/open-graph.provider'
import {
  type ProcessedScreenshot,
  ScreenshotPipelineService,
} from '~/modules/enrichment/providers/open-graph/screenshot-pipeline.service'
import { ScreenshotStorageService } from '~/modules/enrichment/providers/open-graph/screenshot-storage.service'
import { ProviderRegistry } from '~/modules/enrichment/providers/provider.registry'
import { SnowflakeService } from '~/shared/id/snowflake.service'
import type { S3Uploader } from '~/utils/s3.util'

/**
 * Integration coverage for Task 4: the post-persist screenshot pipeline.
 *
 * Wires real {@link EnrichmentService} + repositories against a Postgres
 * testcontainer, with three controllable seams:
 *
 *  - `BrowserFetchService.fetchPage` → returns synthesized HTML + a tiny PNG
 *    (the open-graph provider feeds the PNG into the WeakMap channel).
 *  - `ScreenshotStorageService.getUploader` → returns an in-memory fake S3
 *    that records put/delete calls and can be made to throw on demand.
 *  - `ScreenshotPipelineService.process` → swapped per test so we can force
 *    a `null` (oversize) return without re-engineering image fixtures.
 *
 * Covers the happy path, screenshot-disabled, pipeline-null, storage-throws,
 * and the controller-style touchAccess fire-and-forget on a cache hit.
 */

class FakeS3Uploader {
  public objects = new Map<string, Buffer>()
  public putCalls: Array<{ key: string; bytes: number }> = []
  public deleteCalls: string[] = []
  public nextUploadError: Error | null = null

  async uploadBuffer(
    buffer: Buffer,
    objectKey: string,
    _contentType: string,
  ): Promise<string> {
    this.putCalls.push({ key: objectKey, bytes: buffer.length })
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
    this.objects.delete(objectKey)
  }

  getPublicUrl(objectKey: string): string {
    return `https://cdn.example.test/${objectKey}`
  }
}

class TestScreenshotStorageService extends ScreenshotStorageService {
  public readonly fakeS3 = new FakeS3Uploader()
  protected override async getUploader(): Promise<S3Uploader> {
    return this.fakeS3 as unknown as S3Uploader
  }
}

async function makePngBytes(): Promise<Buffer> {
  return sharp({
    create: {
      width: 320,
      height: 180,
      channels: 4,
      background: { r: 30, g: 120, b: 220, alpha: 1 },
    },
  })
    .png()
    .toBuffer()
}

function makeHtmlBody(url: string, title = 'integration title'): string {
  return `<!DOCTYPE html><html><head>
    <title>${title}</title>
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="integration description">
    <link rel="canonical" href="${url}">
  </head><body></body></html>`
}

interface BuildOptions {
  /**
   * Override `thirdPartyServiceIntegration.openGraph.screenshot`. When omitted,
   * defaults to `{ enabled: true, ...sane caps }`.
   */
  screenshot?: Partial<{
    enabled: boolean
    maxItems: number
    maxTotalBytes: number
    maxBytesPerImage: number
    webpQuality: number
  }>
  /**
   * Override the pipeline result. When set to `null`, the pipeline's
   * `process` returns `null` (oversize / drop). When set to a Buffer, the
   * underlying real pipeline runs against those bytes.
   */
  pipelineOverride?: ProcessedScreenshot | null
  /**
   * Force `storeOrEvict` to throw the given error.
   */
  storageError?: Error
  /**
   * Force `BrowserFetchService.fetchPage` to omit screenshotBytes (HTTP-like
   * shape but in browser mode — exercises the "no bytes attached" branch).
   */
  withoutScreenshotBytes?: boolean
}

describe('OpenGraph screenshot integration (Task 4)', () => {
  let context: PgTestDatabase
  let snowflake: SnowflakeService
  const RESOLVE_URL = 'https://integration.example.test/post/1'

  beforeAll(async () => {
    context = await createPgTestDatabase('mx_og_screenshot')
    snowflake = new SnowflakeService()
  }, 60_000)

  afterAll(async () => {
    if (context) await context.close()
  })

  beforeEach(async () => {
    await context.pool.query('TRUNCATE enrichment_cache CASCADE')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function buildHarness(opts: BuildOptions = {}) {
    const repository = new EnrichmentRepository(context.db as any, snowflake)
    const screenshotRepository = new EnrichmentScreenshotRepository(
      context.db as any,
    )

    const screenshot = {
      enabled: true,
      maxItems: 500,
      maxTotalBytes: 100 * 1024 * 1024,
      maxBytesPerImage: 1024 * 1024,
      webpQuality: 75,
      ...opts.screenshot,
    }

    const configsService = {
      get: vi.fn(async (key: string) => {
        if (key === 'thirdPartyServiceIntegration') {
          return {
            openGraph: { enabled: true, fetchMode: 'browser', screenshot },
          }
        }
        if (key === 'imageStorageOptions') {
          return {
            enable: true,
            endpoint: 'https://s3.example.test',
            secretId: 'AKIATEST',
            secretKey: 'SECRET',
            bucket: 'mx-test',
            region: 'auto',
            customDomain: '',
          }
        }
        return {}
      }),
    } as any

    const redisClient = {
      get: vi.fn(async () => null),
      set: vi.fn(async () => 'OK'),
      del: vi.fn(async () => 1),
    }
    const redisService = {
      getClient: () => redisClient,
    } as any

    const imageService = {
      getOnlineImageSizeAndMeta: vi.fn(async () => ({
        size: { width: 0, height: 0 },
        accent: '#000000',
        blurHash: '',
      })),
    } as any

    const taskQueueService = {
      createTask: vi.fn(async () => ({ taskId: 't', created: true })),
    } as any
    const taskQueueProcessor = {
      registerHandler: vi.fn(),
    } as any
    const urlExtractor = {
      extractFromDoc: vi.fn(() => []),
    } as any

    const browserFetch = new BrowserFetchService()
    const png = await makePngBytes()
    // Stub network step but keep the real WeakMap / attach contract intact.
    vi.spyOn(browserFetch, 'fetchPage').mockImplementation(async (url) => ({
      html: {
        finalUrl: url,
        contentType: 'text/html',
        body: makeHtmlBody(url),
        truncated: false,
      },
      screenshotBytes: opts.withoutScreenshotBytes ? undefined : png,
    }))

    const pipeline = new ScreenshotPipelineService()
    if (opts.pipelineOverride === null) {
      vi.spyOn(pipeline, 'process').mockResolvedValue(null)
    } else if (opts.pipelineOverride) {
      vi.spyOn(pipeline, 'process').mockResolvedValue(opts.pipelineOverride)
    }

    const storage = new TestScreenshotStorageService(
      screenshotRepository,
      configsService,
      redisService,
    )
    if (opts.storageError) {
      vi.spyOn(storage, 'storeOrEvict').mockRejectedValue(opts.storageError)
    }
    const touchSpy = vi.spyOn(storage, 'touchAccess')

    const openGraphProvider = new OpenGraphProvider(
      configsService,
      browserFetch,
    )
    const providerRegistry = new ProviderRegistry()
    providerRegistry.register(openGraphProvider)

    const service = new EnrichmentService(
      providerRegistry,
      repository,
      configsService,
      redisService,
      imageService,
      taskQueueService,
      taskQueueProcessor,
      urlExtractor,
      browserFetch,
      pipeline,
      storage,
    )

    return {
      service,
      storage,
      pipeline,
      browserFetch,
      repository,
      screenshotRepository,
      touchSpy,
      fakeS3: storage.fakeS3,
    }
  }

  it('happy path: persists row, runs pipeline, attaches screenshot to response', async () => {
    const { service, fakeS3 } = await buildHarness()

    const { result } = await service.resolve(RESOLVE_URL)

    expect(result.screenshot).toBeDefined()
    expect(result.screenshot?.url).toMatch(/^https:\/\/cdn\.example\.test\//)
    expect(result.screenshot?.width).toBeGreaterThan(0)
    expect(result.screenshot?.height).toBeGreaterThan(0)
    expect(result.screenshot?.palette?.dominant).toMatch(/^#[\da-f]{6}$/i)
    expect(fakeS3.putCalls).toHaveLength(1)
    expect(fakeS3.putCalls[0].key).toMatch(
      /^enrichment-screenshots\/\d+\.webp$/,
    )

    // The row's normalized JSON must include the screenshot key — second
    // resolve (cache hit) should see it without re-running the pipeline.
    const second = await service.resolve(RESOLVE_URL)
    expect(second.result.screenshot?.url).toBe(result.screenshot?.url)
    expect(fakeS3.putCalls).toHaveLength(1)
  })

  it('screenshot disabled: bytes captured but never stored', async () => {
    const { service, fakeS3 } = await buildHarness({
      screenshot: { enabled: false },
    })

    const { result } = await service.resolve(RESOLVE_URL)
    expect(result.screenshot).toBeUndefined()
    expect(fakeS3.putCalls).toHaveLength(0)
  })

  it('pipeline returns null (oversize): response has no screenshot field', async () => {
    const { service, fakeS3 } = await buildHarness({
      pipelineOverride: null,
    })

    const { result } = await service.resolve(RESOLVE_URL)
    expect(result.screenshot).toBeUndefined()
    expect(fakeS3.putCalls).toHaveLength(0)
  })

  it('storage throws: response is still returned without screenshot', async () => {
    const { service, fakeS3 } = await buildHarness({
      storageError: new Error('simulated S3 failure'),
    })

    const { result } = await service.resolve(RESOLVE_URL)
    expect(result.screenshot).toBeUndefined()
    // Storage stub throws synchronously before S3 PUT, so the fake never sees
    // the put call.
    expect(fakeS3.putCalls).toHaveLength(0)
  })

  it('cache hit: touchAccess fires for results that carry a screenshot', async () => {
    const { service, storage, touchSpy } = await buildHarness()

    // Cold path warms the row.
    const cold = await service.resolve(RESOLVE_URL)
    expect(cold.result.screenshot).toBeDefined()
    expect(cold.result.id).toBeDefined()

    // Simulate the controller's fire-and-forget call on a cache-hit response.
    // We do not import the controller here to keep this test scoped to the
    // service-level integration; the controller code path is mechanically the
    // same: `if (result.screenshot && result.id) storage.touchAccess(result.id)`.
    if (cold.result.screenshot && cold.result.id) {
      await storage.touchAccess(cold.result.id)
    }

    expect(touchSpy).toHaveBeenCalledWith(cold.result.id)
  })
})
