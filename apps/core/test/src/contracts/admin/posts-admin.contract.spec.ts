/**
 * Admin field-presence contract for /posts endpoints.
 *
 * The dashboard list (`apps/admin/src/views/manage-posts/list.tsx`) reads
 * `row.title`, `row.slug`, `row.tags`, `row.read_count`, `row.like_count`,
 * `row.pin_at`, `row.is_published`, `row.category_id`, `row.category.slug`,
 * `row.created_at`, `row.modified_at`. The detail page additionally reads
 * `summary`, `text`, `content`, `content_format`, `meta`, `related[]`.
 *
 * Mongoose-era responses delivered these via aggregate `$lookup`. After the
 * PG cutover the fields come from the repository's `attachCategory` /
 * `attachRelated` helpers and a flat select. This spec pins the keys that
 * the admin UI dereferences without optional chaining, so a regression
 * (e.g. `category` dropped because `select` whitelisted `category_id`
 * only) trips the test instead of breaking production rendering.
 */
import { describe, expect, test } from 'vitest'

import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { AiInsightsService } from '~/modules/ai/ai-insights/ai-insights.service'
import { PostController } from '~/modules/post/post.controller'
import { PostService } from '~/modules/post/post.service'

import {
  assertHasKeys,
  assertHasKeysDeep,
  assertNoLegacyKeys,
  assertPgTimestamps,
} from '../../../helper/api-shape'
import { createE2EApp } from '../../../helper/create-e2e-app'
import { authPassHeader } from '../../../mock/guard/auth.guard'
import { countingServiceProvider } from '../../../mock/processors/counting.mock'
import { translationProvider } from '../../../mock/processors/translation.mock'

const fixturePost = (overrides: Record<string, unknown> = {}) => ({
  id: '7000000000000000010',
  title: 'Hello PG',
  slug: 'hello-pg',
  text: '# body',
  content: null,
  contentFormat: 'markdown',
  summary: null,
  tags: ['tag-a', 'tag-b'],
  meta: null,
  images: [],
  isPublished: true,
  copyright: true,
  pinAt: null,
  pinOrder: null,
  readCount: 7,
  likeCount: 3,
  category: {
    id: '7000000000000000900',
    slug: 'tech',
    name: 'Tech',
    type: 0,
  },
  categoryId: '7000000000000000900',
  related: [],
  createdAt: new Date('2024-01-02T00:00:00.000Z'),
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
    async findById(id: string) {
      return fixturePost({ id })
    },
    async findBySlug(slug: string) {
      return fixturePost({ slug })
    },
    async findRecent() {
      return [fixturePost()]
    },
    async getPostBySlug(_category: string, slug: string) {
      return fixturePost({ slug })
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

// Keys (snake_case post-interceptor) the admin list dereferences directly.
const POST_LIST_REQUIRED_KEYS = [
  'id',
  'title',
  'slug',
  'tags',
  'read_count',
  'like_count',
  'pin_at',
  'is_published',
  'category_id',
  'category',
  'created_at',
  'modified_at',
]

// Keys the admin detail/write page dereferences directly.
const POST_DETAIL_REQUIRED_KEYS = [
  ...POST_LIST_REQUIRED_KEYS,
  'text',
  'content',
  'content_format',
  'summary',
  'meta',
  'images',
  'copyright',
]

describe('PostController admin contract (e2e)', () => {
  const proxy = createE2EApp({
    controllers: [PostController],
    providers: [
      postServiceProvider,
      countingServiceProvider,
      translationProvider,
      aiInsightsProvider,
    ],
  })

  test('GET /posts (admin list) — required field-presence', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/posts`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    assertNoLegacyKeys(body)
    const item = body.data[0]
    assertPgTimestamps(item)
    assertHasKeys(item, POST_LIST_REQUIRED_KEYS)
    // External-link button reads `row.category.slug` without `?.`.
    assertHasKeysDeep(item, ['category.slug', 'category.name', 'category.id'])
  })

  test('GET /posts/:id (admin detail) — required field-presence', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/posts/7000000000000000010`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertNoLegacyKeys(body)
    assertPgTimestamps(body)
    assertHasKeys(body, POST_DETAIL_REQUIRED_KEYS)
    assertHasKeysDeep(body, ['category.slug', 'category.id'])
  })
})
