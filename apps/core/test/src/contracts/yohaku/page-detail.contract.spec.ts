/**
 * Yohaku consumer contract: page detail.
 *
 * Drives `apiClient.page.getBySlug(slug)` consumed by:
 *   - `app/[locale]/(page-detail)/[slug]/*` — `data.id/title/slug/text/
 *     subtitle/contentFormat/content/meta/images/order/created/modified/
 *     allowComment`
 *   - `EquipmentPage.tsx`             — `data.modified`
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
import { enrichmentProvider } from '../../../mock/modules/enrichment.mock'
import { translationProvider } from '../../../mock/processors/translation.mock'

const fixturePage = (overrides: Record<string, unknown> = {}) => ({
  id: '7000000000000000200',
  title: 'About',
  subtitle: 'Yohaku about page',
  slug: 'about',
  text: '# Hello',
  content: null,
  contentFormat: 'markdown',
  meta: { cover: null },
  order: 1,
  images: [],
  createdAt: new Date('2024-04-01T00:00:00.000Z'),
  modifiedAt: new Date('2024-05-01T00:00:00.000Z'),
  ...overrides,
})

const pageServiceProvider = {
  provide: PageService,
  useValue: {
    async findBySlug(slug: string) {
      return fixturePage({ slug })
    },
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
  },
}

describe('Yohaku contract — page detail (e2e)', () => {
  const proxy = createE2EApp({
    controllers: [PageController],
    providers: [pageServiceProvider, translationProvider, enrichmentProvider],
  })

  test('GET /pages/slug/:slug — exposes every field Yohaku reads', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/pages/slug/about`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()

    assertNoLegacyKeys(body)
    assertPgTimestamps(body)

    assertHasKeys(body, [
      'id',
      'title',
      'slug',
      'subtitle',
      'text',
      'content_format',
      'meta',
      'order',
      'images',
      'created_at',
      'modified_at',
    ])
  })

  test('GET /pages — list, items expose nav fields Yohaku reads', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/pages`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    assertNoLegacyKeys(body)
    assertHasKeys(body.data[0], ['id', 'title', 'slug', 'order'])
  })
})
