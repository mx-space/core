/**
 * Yohaku consumer contract: post list (`/posts` route).
 *
 * Drives `apiClient.post.getList()` consumed by:
 *   - `app/[locale]/posts/page.tsx` — `data.findIndex(p => p.pin)`,
 *     `data.map(p => p.title/slug/category/created/modified/count)`
 *   - `PostListItem.tsx`            — `data.title/slug/category/tags/created/
 *                                     modified/count.{read,like}/summary/text`
 *
 * Server emits `pin_at` not `pin` (legacy). Yohaku stale read of `.pin` is
 * reported separately; this spec asserts PG-shape surface is complete.
 */
import { describe, expect, test } from 'vitest'

import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { AiInsightsService } from '~/modules/ai/ai-insights/ai-insights.service'
import { AiSummaryService } from '~/modules/ai/ai-summary/ai-summary.service'
import { PostController } from '~/modules/post/post.controller'
import { PostService } from '~/modules/post/post.service'

import {
  assertHasKeys,
  assertHasKeysDeep,
  assertNoLegacyKeys,
  assertPgTimestamps,
} from '../../../helper/api-shape'
import { createE2EApp } from '../../../helper/create-e2e-app'
import { enrichmentProvider } from '../../../mock/modules/enrichment.mock'
import { entitlementProvider } from '../../../mock/modules/entitlement.mock'
import { snippetProvider } from '../../../mock/modules/snippet.mock'
import { countingServiceProvider } from '../../../mock/processors/counting.mock'
import {
  translationEntryProvider,
  translationProvider,
} from '../../../mock/processors/translation.mock'

const fixturePost = (overrides: Record<string, unknown> = {}) => ({
  id: '7000000000000000060',
  title: 'List Item',
  slug: 'list-item',
  text: 'body text',
  content: null,
  contentFormat: 'markdown',
  summary: 'Hello',
  tags: ['t1'],
  meta: null,
  isPublished: true,
  copyright: true,
  pinAt: new Date('2024-03-01T00:00:00.000Z'),
  pinOrder: 1,
  readCount: 4,
  likeCount: 2,
  images: [],
  category: {
    id: '7000000000000000900',
    slug: 'tech',
    name: 'Tech',
    type: 0,
  },
  categoryId: '7000000000000000900',
  related: [],
  createdAt: new Date('2024-02-01T00:00:00.000Z'),
  modifiedAt: null,
  ...overrides,
})

const postServiceProvider = {
  provide: PostService,
  useValue: {
    async listPaginated({ page = 1, size = 10 } = {}) {
      return {
        data: [fixturePost()],
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

const aiInsightsProvider = {
  provide: AiInsightsService,
  useValue: {
    async hasInsightsInLang() {
      return false
    },
  },
}

const aiSummaryProvider = {
  provide: AiSummaryService,
  useValue: {
    async getSummaryForPublicMeta() {
      return null
    },
  },
}

describe('Yohaku contract — post list (e2e)', () => {
  const proxy = createE2EApp({
    controllers: [PostController],
    providers: [
      postServiceProvider,
      countingServiceProvider,
      translationProvider,
      translationEntryProvider,
      enrichmentProvider,
      aiInsightsProvider,
      aiSummaryProvider,
      snippetProvider,
      entitlementProvider,
    ],
  })

  test('GET /posts — list items expose every field Yohaku reads', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/posts`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data.length).toBeGreaterThan(0)

    assertNoLegacyKeys(body)
    assertPgTimestamps(body.data[0])

    assertHasKeys(body.data[0], [
      'id',
      'title',
      'slug',
      'summary',
      'text',
      'tags',
      'category',
      'category_id',
      'pin_at',
      'read_count',
      'like_count',
      'images',
      'created_at',
      'modified_at',
    ])
    assertHasKeysDeep(body.data[0], ['category.slug', 'category.name'])
    expect(body.meta.pagination).toMatchObject({ total: expect.any(Number) })
  })
})
