import { createE2EApp } from 'test/helper/create-e2e-app'
import { defineProvider } from 'test/helper/defineProvider'
import { authPassHeader } from 'test/mock/guard/auth.guard'
import { vi } from 'vitest'

import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { ConfigsService } from '~/modules/configs/configs.service'
import { EnrichmentController } from '~/modules/enrichment/enrichment.controller'
import { EnrichmentRepository } from '~/modules/enrichment/enrichment.repository'
import { EnrichmentService } from '~/modules/enrichment/enrichment.service'
import { EnrichmentScreenshotRepository } from '~/modules/enrichment/enrichment-screenshot.repository'
import { ScreenshotStorageService } from '~/modules/enrichment/providers/open-graph/screenshot-storage.service'

const baseRow = {
  id: 'row-1',
  provider: 'open-graph',
  externalId: 'og:example',
  url: 'https://example.com/post',
  locale: '',
  normalized: {
    title: 'Hello',
    url: 'https://example.com/post',
    category: 'web',
    fetchedAt: '2026-01-01T00:00:00Z',
  },
  raw: null,
  fetchedAt: new Date('2026-01-01T00:00:00Z'),
  expiresAt: null,
  failureCount: 0,
  lastError: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
}

const baseScreenshotRow = {
  enrichmentId: 'row-1',
  objectKey: 'enrichment-screenshots/row-1.webp',
  bytes: 2048,
  width: 1280,
  height: 720,
  blurhash: 'LKO2?U%2',
  palette: { dominant: '#112233' },
  createdAt: new Date('2026-01-01T00:00:00Z'),
  lastAccessedAt: new Date('2026-01-01T00:00:00Z'),
}

interface ConfigState {
  fetchMode: 'fetch' | 'browser'
  screenshotEnabled: boolean
}

const configState: ConfigState = {
  fetchMode: 'fetch',
  screenshotEnabled: false,
}

const enrichmentRepositoryMock = {
  findById: vi.fn(),
  clearScreenshot: vi.fn(async () => undefined),
}

const screenshotRepositoryMock = {
  findByEnrichmentId: vi.fn(),
  getQuotaUsage: vi.fn(async () => ({ count: 3, totalBytes: 4096 })),
  listJoined: vi.fn(),
}

const screenshotStorageMock = {
  delete: vi.fn(async () => undefined),
  touchAccess: vi.fn(async () => undefined),
  getPublicUrlFor: vi.fn(
    async (objectKey: string) => `https://cdn.example.test/${objectKey}`,
  ),
}

const enrichmentServiceMock = {
  resolve: vi.fn(),
  refresh: vi.fn(async () => baseRow.normalized),
  probe: vi.fn(),
  matchUrlToRef: vi.fn(),
}

const configsServiceMock = {
  get: vi.fn(async (key: string) => {
    if (key === 'thirdPartyServiceIntegration') {
      return {
        openGraph: {
          fetchMode: configState.fetchMode,
          screenshot: {
            enabled: configState.screenshotEnabled,
            maxItems: 500,
            maxTotalBytes: 100 * 1024 * 1024,
          },
        },
      }
    }
    return {}
  }),
}

const providers = [
  defineProvider({
    provide: EnrichmentService,
    useValue: enrichmentServiceMock as unknown as EnrichmentService,
  }),
  defineProvider({
    provide: EnrichmentRepository,
    useValue: enrichmentRepositoryMock as unknown as EnrichmentRepository,
  }),
  defineProvider({
    provide: EnrichmentScreenshotRepository,
    useValue:
      screenshotRepositoryMock as unknown as EnrichmentScreenshotRepository,
  }),
  defineProvider({
    provide: ScreenshotStorageService,
    useValue: screenshotStorageMock as unknown as ScreenshotStorageService,
  }),
  defineProvider({
    provide: ConfigsService,
    useValue: configsServiceMock as unknown as ConfigsService,
  }),
]

describe('EnrichmentController admin endpoints (e2e)', () => {
  const proxy = createE2EApp({
    controllers: [EnrichmentController],
    providers,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    configState.fetchMode = 'fetch'
    configState.screenshotEnabled = false
    enrichmentRepositoryMock.findById.mockResolvedValue(baseRow)
    enrichmentRepositoryMock.clearScreenshot.mockResolvedValue(undefined)
    screenshotRepositoryMock.findByEnrichmentId.mockResolvedValue(
      baseScreenshotRow,
    )
    screenshotRepositoryMock.getQuotaUsage.mockResolvedValue({
      count: 3,
      totalBytes: 4096,
    })
    screenshotRepositoryMock.listJoined.mockResolvedValue({
      data: [
        {
          enrichmentId: 'row-1',
          provider: 'open-graph',
          externalId: 'og:example',
          url: 'https://example.com/post',
          title: 'Hello',
          objectKey: 'enrichment-screenshots/row-1.webp',
          bytes: 2048,
          width: 1280,
          height: 720,
          blurhash: null,
          palette: null,
          createdAt: new Date('2026-01-01T00:00:00Z'),
          lastAccessedAt: new Date('2026-01-01T00:00:00Z'),
        },
      ],
      pagination: {
        currentPage: 1,
        totalPage: 1,
        total: 1,
        size: 20,
        hasNextPage: false,
        hasPrevPage: false,
      },
    })
    screenshotStorageMock.delete.mockResolvedValue(undefined)
    screenshotStorageMock.getPublicUrlFor.mockImplementation(
      async (objectKey: string) => `https://cdn.example.test/${objectKey}`,
    )
    enrichmentServiceMock.refresh.mockResolvedValue(baseRow.normalized as any)
  })

  describe('auth gating', () => {
    const endpoints: Array<{
      method: 'GET' | 'POST' | 'DELETE'
      url: string
      body?: unknown
    }> = [
      { method: 'GET', url: 'enrichment/admin/by-id/row-1' },
      { method: 'GET', url: 'enrichment/admin/screenshots' },
      { method: 'GET', url: 'enrichment/admin/screenshots/quota' },
      { method: 'DELETE', url: 'enrichment/admin/screenshots/row-1' },
      {
        method: 'POST',
        url: 'enrichment/admin/screenshots/row-1/recapture',
      },
      {
        method: 'POST',
        url: 'enrichment/admin/probe',
        body: { url: 'https://example.com' },
      },
    ]

    test.each(endpoints)(
      'rejects $method $url without auth',
      async ({ method, url, body }) => {
        const res = await proxy.app.inject({
          method,
          url: `${apiRoutePrefix}/${url}`,
          ...(body ? { payload: body } : {}),
        })
        expect(res.statusCode).toBe(401)
      },
    )
  })

  test('GET admin/by-id/:id returns row with screenshot', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/enrichment/admin/by-id/row-1`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.id).toBe('row-1')
    expect(body.screenshot).toBeTruthy()
    expect(body.screenshot.object_key).toBe('enrichment-screenshots/row-1.webp')
  })

  test('GET admin/by-id/:id 404 when missing', async () => {
    enrichmentRepositoryMock.findById.mockResolvedValueOnce(null)
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/enrichment/admin/by-id/nope`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(404)
  })

  test('GET admin/screenshots returns list with public_url', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/enrichment/admin/screenshots?page=1&size=20&sort=last_accessed&order=desc`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].public_url).toBe(
      'https://cdn.example.test/enrichment-screenshots/row-1.webp',
    )
    expect(body.pagination.total).toBe(1)
  })

  test('GET admin/screenshots returns publicUrl empty when storage unconfigured', async () => {
    screenshotStorageMock.getPublicUrlFor.mockRejectedValueOnce(
      new Error('not configured'),
    )
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/enrichment/admin/screenshots`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data[0].public_url).toBe('')
  })

  test('GET admin/screenshots/quota reflects config + usage', async () => {
    configState.fetchMode = 'browser'
    configState.screenshotEnabled = true
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/enrichment/admin/screenshots/quota`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.used.count).toBe(3)
    expect(body.used.total_bytes).toBe(4096)
    expect(body.cap.max_items).toBe(500)
    expect(body.enabled).toBe(true)
    expect(body.fetch_mode).toBe('browser')
  })

  test('DELETE admin/screenshots/:id 204 even when not present', async () => {
    const res = await proxy.app.inject({
      method: 'DELETE',
      url: `${apiRoutePrefix}/enrichment/admin/screenshots/row-1`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(204)
    expect(screenshotStorageMock.delete).toHaveBeenCalledWith('row-1')
    expect(enrichmentRepositoryMock.clearScreenshot).toHaveBeenCalledWith(
      'row-1',
    )
  })

  test('POST admin/screenshots/:id/recapture 409 when fetchMode != browser', async () => {
    configState.fetchMode = 'fetch'
    configState.screenshotEnabled = true
    const res = await proxy.app.inject({
      method: 'POST',
      url: `${apiRoutePrefix}/enrichment/admin/screenshots/row-1/recapture`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(409)
    const body = res.json()
    expect(body.message?.code ?? body.code).toBe('browser_mode_required')
  })

  test('POST admin/screenshots/:id/recapture 409 when screenshot disabled', async () => {
    configState.fetchMode = 'browser'
    configState.screenshotEnabled = false
    const res = await proxy.app.inject({
      method: 'POST',
      url: `${apiRoutePrefix}/enrichment/admin/screenshots/row-1/recapture`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(409)
    const body = res.json()
    expect(body.message?.code ?? body.code).toBe('screenshot_disabled')
  })

  test('POST admin/screenshots/:id/recapture 404 for unknown id', async () => {
    enrichmentRepositoryMock.findById.mockResolvedValueOnce(null)
    const res = await proxy.app.inject({
      method: 'POST',
      url: `${apiRoutePrefix}/enrichment/admin/screenshots/missing/recapture`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(404)
  })

  test('POST admin/screenshots/:id/recapture happy path returns screenshot', async () => {
    configState.fetchMode = 'browser'
    configState.screenshotEnabled = true
    const screenshot = {
      url: 'https://cdn.example.test/enrichment-screenshots/row-1.webp',
      width: 1280,
      height: 720,
      blurhash: 'L_X',
    }
    enrichmentRepositoryMock.findById
      .mockResolvedValueOnce(baseRow)
      .mockResolvedValueOnce({
        ...baseRow,
        normalized: { ...baseRow.normalized, screenshot } as any,
      })

    const res = await proxy.app.inject({
      method: 'POST',
      url: `${apiRoutePrefix}/enrichment/admin/screenshots/row-1/recapture`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(200)
    expect(enrichmentServiceMock.refresh).toHaveBeenCalledWith(
      'open-graph',
      'og:example',
      '',
      { url: 'https://example.com/post' },
    )
    const body = res.json()
    expect(body.url).toBe(screenshot.url)
  })

  test('POST admin/probe forwards useCache=true and returns result', async () => {
    enrichmentServiceMock.probe.mockResolvedValueOnce({
      matched: { provider: 'open-graph', externalId: 'og:abc' },
      result: { title: 'cached', url: 'https://example.com' },
      cached: true,
    })
    const res = await proxy.app.inject({
      method: 'POST',
      url: `${apiRoutePrefix}/enrichment/admin/probe`,
      headers: authPassHeader,
      payload: { url: 'https://example.com', useCache: true },
    })
    expect(res.statusCode).toBe(200)
    expect(enrichmentServiceMock.probe).toHaveBeenCalledWith(
      'https://example.com',
      true,
    )
    const body = res.json()
    expect(body.cached).toBe(true)
    expect(body.result.title).toBe('cached')
  })

  test('POST admin/probe with useCache=false default', async () => {
    enrichmentServiceMock.probe.mockResolvedValueOnce({
      matched: null,
      result: null,
      cached: false,
      error: { code: 'unknown_provider', message: 'no match' },
    })
    const res = await proxy.app.inject({
      method: 'POST',
      url: `${apiRoutePrefix}/enrichment/admin/probe`,
      headers: authPassHeader,
      payload: { url: 'https://example.com' },
    })
    expect(res.statusCode).toBe(200)
    expect(enrichmentServiceMock.probe).toHaveBeenCalledWith(
      'https://example.com',
      false,
    )
    expect(res.json().error.code).toBe('unknown_provider')
  })
})
