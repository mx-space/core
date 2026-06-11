import { describe, expect, test } from 'vitest'

import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { POST_SERVICE_TOKEN } from '~/constants/injection.constant'
import { CategoryController } from '~/modules/category/category.controller'
import { CategoryService } from '~/modules/category/category.service'

import {
  assertHasKeys,
  assertNoLegacyKeys,
  assertPgTimestamps,
} from '../../helper/api-shape'
import { createE2EApp } from '../../helper/create-e2e-app'
import {
  translationEntryProvider,
  translationProvider,
} from '../../mock/processors/translation.mock'

/** SDK `CategoryModel` 之必填键（packages/api-client/models/category.ts）。 */
const EXPECTED_CATEGORY_MODEL_KEYS = [
  'id',
  'created_at',
  'type',
  'slug',
  'name',
]

const fixtureCategory = (overrides: Record<string, unknown> = {}) => ({
  id: '7000000000000000900',
  name: 'Tech',
  slug: 'tech',
  type: 0,
  createdAt: new Date('2023-12-01T00:00:00.000Z'),
  modifiedAt: null,
  ...overrides,
})

const categoryServiceProvider = {
  provide: CategoryService,
  useValue: {
    async findAllCategory() {
      return [fixtureCategory()]
    },
    async findById(id: string) {
      return fixtureCategory({ id })
    },
    async findBySlug(slug: string) {
      return fixtureCategory({ slug })
    },
    async findCategoryPost() {
      return []
    },
    async getCategoryTagsSum() {
      return []
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
      return 0
    },
    async listByCategory() {
      return []
    },
    async listByCategoryIds() {
      return new Map()
    },
  },
}

describe('CategoryController contract (e2e)', () => {
  const proxy = createE2EApp({
    controllers: [CategoryController],
    providers: [
      categoryServiceProvider,
      postServiceProvider,
      translationProvider,
      translationEntryProvider,
    ],
  })

  test('GET /categories — list, no legacy keys', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/categories`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    assertNoLegacyKeys(body)
    assertPgTimestamps(body.data[0])
  })

  test('GET /categories/:slug — detail with children, no legacy keys', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/categories/tech`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertNoLegacyKeys(body)
    assertPgTimestamps(body.data)
  })

  test('GET /categories?ids=...&joint=true — entries map, no legacy keys', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/categories?ids=7000000000000000900&joint=true`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertNoLegacyKeys(body)
    expect(body.data.entries).toBeDefined()
  })

  test('SDK shape — every CategoryModel key present on list rows', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/categories`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertHasKeys(body.data[0], EXPECTED_CATEGORY_MODEL_KEYS)
  })
})
