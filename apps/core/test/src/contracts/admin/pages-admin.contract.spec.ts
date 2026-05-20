/**
 * Admin field-presence contract for /pages endpoints.
 *
 * Dashboard pages list/edit (`apps/admin/src/views/manage-pages/list.tsx`,
 * `write.tsx`) reads `page.id`, `page.title`, `page.slug`, `page.subtitle`,
 * `page.order`, `page.created_at`, `page.modified_at`, `page.text`,
 * `page.content`, `page.content_format`, `page.meta`.
 */
import { describe, expect, test } from 'vitest'

import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { PageController } from '~/modules/page/page.controller'
import { PageService } from '~/modules/page/page.service'

import {
  assertHasKeys,
  assertNoLegacyKeys,
  assertPgTimestamps,
} from '../../../helper/api-shape'
import { createE2EApp } from '../../../helper/create-e2e-app'
import { authPassHeader } from '../../../mock/guard/auth.guard'
import { enrichmentProvider } from '../../../mock/modules/enrichment.mock'
import { translationProvider } from '../../../mock/processors/translation.mock'

const fixturePage = (overrides: Record<string, unknown> = {}) => ({
  id: '7000000000000000040',
  title: 'About',
  slug: 'about',
  subtitle: 'About me',
  order: 1,
  text: 'page body',
  content: null,
  contentFormat: 'markdown',
  meta: null,
  images: [],
  createdAt: new Date('2024-02-01T00:00:00.000Z'),
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
    async findById(id: string) {
      return fixturePage({ id })
    },
    async findBySlug(slug: string) {
      return fixturePage({ slug })
    },
  },
}

const PAGE_REQUIRED_KEYS = [
  'id',
  'title',
  'slug',
  'subtitle',
  'order',
  'text',
  'content',
  'content_format',
  'meta',
  'created_at',
  'modified_at',
]

describe('PageController admin contract (e2e)', () => {
  const proxy = createE2EApp({
    controllers: [PageController],
    providers: [pageServiceProvider, translationProvider, enrichmentProvider],
  })

  test('GET /pages (admin list) — required field-presence', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/pages`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    assertNoLegacyKeys(body)
    assertPgTimestamps(body.data[0])
    assertHasKeys(body.data[0], PAGE_REQUIRED_KEYS)
  })

  test('GET /pages/:id (admin detail) — required field-presence', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/pages/7000000000000000040`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertNoLegacyKeys(body)
    assertPgTimestamps(body.data)
    assertHasKeys(body.data, PAGE_REQUIRED_KEYS)
  })
})
