import { describe, expect, test } from 'vitest'

import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { PageController } from '~/modules/page/page.controller'
import { PageService } from '~/modules/page/page.service'

import { assertNoLegacyKeys, assertPgTimestamps } from '../../helper/api-shape'
import { createE2EApp } from '../../helper/create-e2e-app'
import { translationProvider } from '../../mock/processors/translation.mock'

const fixturePage = (overrides: Record<string, unknown> = {}) => ({
  id: '7000000000000000001',
  title: 'About',
  slug: 'about',
  text: '# Hello',
  content: null,
  contentFormat: 'markdown',
  subtitle: null,
  meta: null,
  order: 0,
  isPublished: true,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  modifiedAt: null,
  ...overrides,
})

const pageServiceProvider = {
  provide: PageService,
  useValue: {
    async listPaginated(page = 1, size = 10) {
      return {
        data: [fixturePage()],
        pagination: {
          total: 1,
          currentPage: page,
          totalPage: 1,
          size,
          hasNextPage: false,
          hasPrevPage: false,
        },
      }
    },
    async findBySlug(_slug: string) {
      return fixturePage({ slug: _slug })
    },
  },
}

describe('PageController contract (e2e)', () => {
  const proxy = createE2EApp({
    controllers: [PageController],
    providers: [pageServiceProvider, translationProvider],
  })

  test('GET /pages returns PG-shape items, no legacy keys', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/pages`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    assertNoLegacyKeys(body)
    assertPgTimestamps(body.data[0])
  })

  test('GET /pages/slug/:slug returns single PG-shape entity', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/pages/slug/about`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertNoLegacyKeys(body)
    assertPgTimestamps(body)
  })
})
