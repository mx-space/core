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
} from '../../helper/api-shape'
import { createE2EApp } from '../../helper/create-e2e-app'
import { enrichmentProvider } from '../../mock/modules/enrichment.mock'
import { countingServiceProvider } from '../../mock/processors/counting.mock'
import { translationProvider } from '../../mock/processors/translation.mock'

/**
 * SDK `PostModelMarkdown` 之必填键（packages/api-client/models/post.ts）。
 * Lexical 变体之 `content`/`contentFormat` 为变体特异，不入此通用 contract。
 */
const EXPECTED_POST_MODEL_KEYS = [
  'id',
  'created_at',
  'modified_at',
  'title',
  'text',
  'meta',
  'summary',
  'copyright',
  'tags',
  'slug',
  'category_id',
  'category',
  'images',
  'is_published',
  'read_count',
  'like_count',
  'pin_at',
  'pin_order',
  'related',
]

const fixturePost = (overrides: Record<string, unknown> = {}) => ({
  id: '7000000000000000010',
  title: 'Hello PG',
  slug: 'hello-pg',
  text: '# body',
  content: null,
  contentFormat: 'markdown',
  summary: null,
  copyright: false,
  tags: [],
  meta: null,
  images: null,
  isPublished: true,
  pinAt: null,
  pinOrder: null,
  readCount: 7,
  likeCount: 3,
  category: {
    id: '7000000000000000900',
    slug: 'tech',
    name: 'Tech',
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

describe('PostController contract (e2e)', () => {
  const proxy = createE2EApp({
    controllers: [PostController],
    providers: [
      postServiceProvider,
      countingServiceProvider,
      translationProvider,
      enrichmentProvider,
      aiInsightsProvider,
    ],
  })

  test('GET /posts list — no legacy keys, PG timestamps', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/posts`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    assertNoLegacyKeys(body)
    assertPgTimestamps(body.data[0])
  })

  test('GET /posts/:id detail — no legacy keys, PG timestamps', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/posts/7000000000000000010`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertNoLegacyKeys(body)
    assertPgTimestamps(body)
  })

  test('GET /posts/:category/:slug — public detail, no legacy keys', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/posts/tech/hello-pg`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertNoLegacyKeys(body)
    assertPgTimestamps(body)
  })

  test('GET /posts/latest — latest post, no legacy keys', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/posts/latest`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertNoLegacyKeys(body)
    assertPgTimestamps(body)
  })

  test('GET /posts/get-url/:slug — slug→path resolver, no legacy keys', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/posts/get-url/hello-pg`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertNoLegacyKeys(body)
    expect(typeof body.path).toBe('string')
  })

  test('SDK shape — every PostModel key present on list rows', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/posts`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertHasKeys(body.data[0], EXPECTED_POST_MODEL_KEYS)
    assertHasKeysDeep(body.data[0], [
      'category.id',
      'category.slug',
      'category.name',
    ])
  })

  test('SDK shape — every PostModel key present on detail', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/posts/7000000000000000010`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertHasKeys(body, EXPECTED_POST_MODEL_KEYS)
  })
})
