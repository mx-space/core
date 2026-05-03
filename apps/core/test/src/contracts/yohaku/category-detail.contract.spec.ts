/**
 * Yohaku consumer contract: category list + detail.
 *
 * Drives:
 *   - `apiClient.category.getAllCategories()`        — `data[].id/slug/name`
 *   - `apiClient.category.getCategoryByIdOrSlug()`   — `{ data: {...res, count,
 *     children, tagsSum} }`. Yohaku reads `data.name/count/children/tagsSum`,
 *     `children[*].pin/created/title/slug/category/count/text/summary/images/
 *     tags/modified`.
 *   - `apiClient.category.getCategoryDetail`         — `{ entries: { id: { ...
 *     category, children: PostListItem[] } } }`
 */
import { describe, expect, test } from 'vitest'

import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { POST_SERVICE_TOKEN } from '~/constants/injection.constant'
import { CategoryController } from '~/modules/category/category.controller'
import { CategoryService } from '~/modules/category/category.service'

import {
  assertHasKeys,
  assertHasKeysDeep,
  assertNoLegacyKeys,
  assertPgTimestamps,
} from '../../../helper/api-shape'
import { createE2EApp } from '../../../helper/create-e2e-app'
import { translationProvider } from '../../../mock/processors/translation.mock'

const fixtureCategory = (overrides: Record<string, unknown> = {}) => ({
  id: '7000000000000000900',
  name: 'Tech',
  slug: 'tech',
  type: 0,
  createdAt: new Date('2023-12-01T00:00:00.000Z'),
  modifiedAt: null,
  ...overrides,
})

const fixturePost = (overrides: Record<string, unknown> = {}) => ({
  id: '7000000000000000910',
  title: 'Child Post',
  slug: 'child-post',
  text: 'body',
  contentFormat: 'markdown',
  summary: 'sum',
  meta: null,
  images: [],
  tags: ['x'],
  isPublished: true,
  copyright: true,
  pinAt: null,
  pinOrder: null,
  readCount: 1,
  likeCount: 0,
  category: fixtureCategory(),
  categoryId: '7000000000000000900',
  related: [],
  createdAt: new Date('2024-01-15T00:00:00.000Z'),
  modifiedAt: null,
  ...overrides,
})

const categoryServiceProvider = {
  provide: CategoryService,
  useValue: {
    async findAllCategory() {
      return [fixtureCategory()]
    },
    async findCategoryById(id: string) {
      return fixtureCategory({ id })
    },
    async findById(id: string) {
      return fixtureCategory({ id })
    },
    async findBySlug(slug: string) {
      return fixtureCategory({ slug })
    },
    async findCategoryPost() {
      return [fixturePost()]
    },
    async getCategoryTagsSum() {
      return [{ name: 'x', count: 1 }]
    },
    async getPostTagsSum() {
      return []
    },
  },
}

const postServiceProvider = {
  provide: POST_SERVICE_TOKEN,
  useValue: {
    async countByCategoryId() {
      return 1
    },
    async listByCategory() {
      return [fixturePost()]
    },
  },
}

describe('Yohaku contract — category (e2e)', () => {
  const proxy = createE2EApp({
    controllers: [CategoryController],
    providers: [
      categoryServiceProvider,
      postServiceProvider,
      translationProvider,
    ],
  })

  test('GET /categories — list, items expose nav fields Yohaku reads', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/categories`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    assertNoLegacyKeys(body)
    assertPgTimestamps(body.data[0])
    assertHasKeys(body.data[0], ['id', 'name', 'slug'])
  })

  test('GET /categories/:slug — detail wraps PG-shape category + children', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/categories/tech`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()

    assertNoLegacyKeys(body)
    expect(body.data).toBeTruthy()
    assertPgTimestamps(body.data)

    assertHasKeys(body.data, ['id', 'name', 'slug', 'count', 'children'])

    const child = body.data.children[0]
    assertHasKeys(child, [
      'id',
      'title',
      'slug',
      'summary',
      'pin_at',
      'tags',
      'read_count',
      'like_count',
      'created_at',
      'modified_at',
    ])
    assertHasKeysDeep(child, ['category.slug', 'category.name'])
  })
})
