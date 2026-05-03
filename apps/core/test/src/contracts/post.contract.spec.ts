import { describe, expect, test } from 'vitest'

import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { AiInsightsService } from '~/modules/ai/ai-insights/ai-insights.service'
import { PostController } from '~/modules/post/post.controller'
import { PostService } from '~/modules/post/post.service'

import { assertNoLegacyKeys, assertPgTimestamps } from '../../helper/api-shape'
import { createE2EApp } from '../../helper/create-e2e-app'
import { countingServiceProvider } from '../../mock/processors/counting.mock'
import { translationProvider } from '../../mock/processors/translation.mock'

const fixturePost = (overrides: Record<string, unknown> = {}) => ({
  id: '7000000000000000010',
  title: 'Hello PG',
  slug: 'hello-pg',
  text: '# body',
  content: null,
  contentFormat: 'markdown',
  summary: null,
  tags: [],
  meta: null,
  isPublished: true,
  pinAt: null,
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
})
