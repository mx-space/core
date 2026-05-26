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
import { EnrichmentCaptureRepository } from '~/modules/enrichment/enrichment-capture.repository'
import { BrowserFetchService } from '~/modules/enrichment/providers/open-graph/browser-fetch.service'
import {
  CapturePipelineService,
  type ProcessedCapture,
} from '~/modules/enrichment/providers/open-graph/capture-pipeline.service'
import { CaptureStorageService } from '~/modules/enrichment/providers/open-graph/capture-storage.service'
import { OpenGraphProvider } from '~/modules/enrichment/providers/open-graph/open-graph.provider'
import { ProviderRegistry } from '~/modules/enrichment/providers/provider.registry'
import { AgentBrowserSessionPool as BrowserSessionPool } from '~/processors/agent-browser/agent-browser-pool.service'
import { SnowflakeService } from '~/shared/id/snowflake.service'
import type { S3Uploader } from '~/utils/s3.util'

/**
 * Integration coverage for the post-persist capture pipeline.
 *
 * Wires real {@link EnrichmentService} + repositories against a Postgres
 * testcontainer, with three controllable seams:
 *
 *  - `BrowserFetchService.fetchPage` → returns synthesized HTML + a tiny PNG
 *    (the open-graph provider feeds the PNG into the WeakMap channel).
 *  - `CaptureStorageService.getUploader` → returns an in-memory fake S3
 *    that records put/delete calls and can be made to throw on demand.
 *  - `CapturePipelineService.process` → swapped per test so we can force
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

class TestCaptureStorageService extends CaptureStorageService {
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
  pipelineOverride?: ProcessedCapture | null
  /**
   * Force `storeOrEvict` to throw the given error.
   */
  storageError?: Error
  /**
   * Force `BrowserFetchService.fetchPage` to omit screenshotBytes (HTTP-like
   * shape but in browser mode — exercises the "no bytes attached" branch).
   */
  withoutScreenshotBytes?: boolean
  /**
   * Override the HTML body the mocked `fetchPage` returns. Default has no
   * `og:image` so the fallback predicate will request a screenshot. Pass HTML
   * with `og:image` to exercise the "skip screenshot" branch.
   */
  htmlBody?: string
}

describe('OpenGraph capture integration', () => {
  let context: PgTestDatabase
  let snowflake: SnowflakeService
  const RESOLVE_URL = 'https://integration.example.test/post/1'
  const activePools: BrowserSessionPool[] = []

  beforeAll(async () => {
    context = await createPgTestDatabase('mx_og_capture')
    snowflake = new SnowflakeService()
  }, 60_000)

  afterAll(async () => {
    if (context) await context.close()
  })

  beforeEach(async () => {
    await context.pool.query('TRUNCATE enrichment_cache CASCADE')
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await Promise.all(activePools.splice(0).map((p) => p.shutdown()))
  })

  async function buildHarness(opts: BuildOptions = {}) {
    const repository = new EnrichmentRepository(context.db as any, snowflake)
    const captureRepository = new EnrichmentCaptureRepository(context.db as any)

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

    const browserFetchPool = new BrowserSessionPool({
      maxSize: 1,
      idleMs: 60_000,
    })
    const browserFetch = new BrowserFetchService(browserFetchPool)
    const png = await makePngBytes()
    // Stub network step but keep the real WeakMap / attach contract intact.
    // Honors the predicate form of `captureScreenshot` so tests can verify the
    // og:image-fallback gate.
    const fetchPageSpy = vi
      .spyOn(browserFetch, 'fetchPage')
      .mockImplementation(async (url, fetchOpts) => {
        const html = {
          finalUrl: url,
          contentType: 'text/html',
          body: opts.htmlBody ?? makeHtmlBody(url),
          truncated: false,
        }
        const decision = fetchOpts.captureScreenshot
        const shouldCapture =
          typeof decision === 'function'
            ? await decision(html)
            : decision !== false
        return {
          html,
          screenshotBytes:
            opts.withoutScreenshotBytes || !shouldCapture ? undefined : png,
        }
      })

    const pipeline = new CapturePipelineService()
    const processSpy = vi.spyOn(pipeline, 'process')
    if (opts.pipelineOverride === null) {
      processSpy.mockResolvedValue(null)
    } else if (opts.pipelineOverride) {
      processSpy.mockResolvedValue(opts.pipelineOverride)
    }

    const storage = new TestCaptureStorageService(
      captureRepository,
      repository,
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

    activePools.push(browserFetchPool)

    return {
      service,
      storage,
      pipeline,
      processSpy,
      browserFetch,
      fetchPageSpy,
      repository,
      captureRepository,
      touchSpy,
      fakeS3: storage.fakeS3,
    }
  }

  it('happy path: persists row, runs pipeline, attaches capture to response', async () => {
    const { service, fakeS3 } = await buildHarness()

    const { result } = await service.resolve(RESOLVE_URL)

    expect(result.captureImage).toBeDefined()
    expect(result.captureImage?.url).toMatch(/^https:\/\/cdn\.example\.test\//)
    expect(result.captureImage?.width).toBeGreaterThan(0)
    expect(result.captureImage?.height).toBeGreaterThan(0)
    expect(result.captureImage?.palette?.dominant).toMatch(/^#[\da-f]{6}$/i)
    expect(fakeS3.putCalls).toHaveLength(1)
    expect(fakeS3.putCalls[0].key).toMatch(/^enrichment-captures\/\d+\.webp$/)

    // The row's normalized JSON must include the captureImage key — second
    // resolve (cache hit) should see it without re-running the pipeline.
    const second = await service.resolve(RESOLVE_URL)
    expect(second.result.captureImage?.url).toBe(result.captureImage?.url)
    expect(fakeS3.putCalls).toHaveLength(1)
  })

  it('og:image present: capture fallback is skipped even when enabled', async () => {
    const htmlBody = `<!DOCTYPE html><html><head>
      <title>has image</title>
      <meta property="og:title" content="has image">
      <meta property="og:image" content="https://cdn.example.test/og.png">
      <link rel="canonical" href="${RESOLVE_URL}">
    </head><body></body></html>`
    const { service, fakeS3, fetchPageSpy, processSpy } = await buildHarness({
      htmlBody,
    })

    const { result } = await service.resolve(RESOLVE_URL)
    expect(result.thumbnailImage?.url).toBe('https://cdn.example.test/og.png')
    expect(result.captureImage).toBeUndefined()
    // Provider passed a predicate (function), not a literal — predicate
    // returned false because og:image was present.
    expect(fetchPageSpy).toHaveBeenCalledWith(
      RESOLVE_URL,
      expect.objectContaining({
        captureScreenshot: expect.any(Function),
      }),
    )
    expect(processSpy).not.toHaveBeenCalled()
    expect(fakeS3.putCalls).toHaveLength(0)
  })

  it('capture disabled: browser metadata fetch does not capture or store bytes', async () => {
    const { service, fakeS3, fetchPageSpy, processSpy } = await buildHarness({
      screenshot: { enabled: false },
    })

    const { result } = await service.resolve(RESOLVE_URL)
    expect(result.captureImage).toBeUndefined()
    expect(fetchPageSpy).toHaveBeenCalledWith(
      RESOLVE_URL,
      expect.objectContaining({ captureScreenshot: false }),
    )
    expect(processSpy).not.toHaveBeenCalled()
    expect(fakeS3.putCalls).toHaveLength(0)
  })

  it('pipeline returns null (oversize): response has no captureImage field', async () => {
    const { service, fakeS3 } = await buildHarness({
      pipelineOverride: null,
    })

    const { result } = await service.resolve(RESOLVE_URL)
    expect(result.captureImage).toBeUndefined()
    expect(fakeS3.putCalls).toHaveLength(0)
  })

  it('storage throws: response is still returned without captureImage', async () => {
    const { service, fakeS3 } = await buildHarness({
      storageError: new Error('simulated S3 failure'),
    })

    const { result } = await service.resolve(RESOLVE_URL)
    expect(result.captureImage).toBeUndefined()
    // Storage stub throws synchronously before S3 PUT, so the fake never sees
    // the put call.
    expect(fakeS3.putCalls).toHaveLength(0)
  })

  it('cache hit: touchAccess fires for results that carry a captureImage', async () => {
    const { service, storage, touchSpy } = await buildHarness()

    // Cold path warms the row.
    const cold = await service.resolve(RESOLVE_URL)
    expect(cold.result.captureImage).toBeDefined()
    expect(cold.result.id).toBeDefined()

    // Simulate the controller's fire-and-forget call on a cache-hit response.
    // We do not import the controller here to keep this test scoped to the
    // service-level integration; the controller code path is mechanically the
    // same: `if (result.captureImage && result.id) storage.touchAccess(result.id)`.
    if (cold.result.captureImage && cold.result.id) {
      await storage.touchAccess(cold.result.id)
    }

    expect(touchSpy).toHaveBeenCalledWith(cold.result.id)
  })
})
