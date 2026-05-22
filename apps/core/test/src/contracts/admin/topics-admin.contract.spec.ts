/**
 * Admin field-presence contract for /topics endpoints.
 *
 * Dashboard topic management (`apps/admin/src/api/topics.ts` +
 * `views/manage-notes/topic.tsx`) reads `topic.id`, `topic.name`,
 * `topic.slug`, `topic.introduce`, `topic.description`, `topic.icon`,
 * `topic.created_at`. Topics have no `modified_at` column.
 */
import { describe, expect, test } from 'vitest'

import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { TopicBaseController } from '~/modules/topic/topic.controller'
import { TopicRepository } from '~/modules/topic/topic.repository'

import { assertHasKeys, assertNoLegacyKeys } from '../../../helper/api-shape'
import { createE2EApp } from '../../../helper/create-e2e-app'
import { authPassHeader } from '../../../mock/guard/auth.guard'
import { eventEmitterProvider } from '../../../mock/processors/event.mock'
import { translationEntryProvider } from '../../../mock/processors/translation.mock'

const fixtureTopic = (overrides: Record<string, unknown> = {}) => ({
  id: '7000000000000000800',
  name: 'Daily',
  slug: 'daily',
  description: 'Daily musings',
  introduce: 'A topic for daily notes',
  icon: 'https://example.com/icon.png',
  createdAt: new Date('2024-01-10T00:00:00.000Z'),
  ...overrides,
})

const topicRepoProvider = {
  provide: TopicRepository,
  useValue: {
    async list(page = 1, size = 10) {
      return {
        data: [fixtureTopic()],
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
    async findAll() {
      return [fixtureTopic()]
    },
    async findById(id: string) {
      return fixtureTopic({ id })
    },
    async findBySlug(slug: string) {
      return fixtureTopic({ slug })
    },
    async create(input: any) {
      return fixtureTopic(input)
    },
    async update(_id: string, patch: any) {
      return fixtureTopic(patch)
    },
    async deleteById() {
      return fixtureTopic()
    },
  },
}

const TOPIC_REQUIRED_KEYS = [
  'id',
  'name',
  'slug',
  'description',
  'introduce',
  'icon',
  'created_at',
]

describe('TopicController admin contract (e2e)', () => {
  const proxy = createE2EApp({
    controllers: [TopicBaseController],
    providers: [
      topicRepoProvider,
      translationEntryProvider,
      ...eventEmitterProvider,
    ],
  })

  test('GET /topics (admin list) — required field-presence', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/topics`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    assertNoLegacyKeys(body)
    assertHasKeys(body.data[0], TOPIC_REQUIRED_KEYS)
  })

  test('GET /topics/all (admin select-source) — required field-presence', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/topics/all`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    assertNoLegacyKeys(body)
    assertHasKeys(body.data[0], TOPIC_REQUIRED_KEYS)
  })

  test('GET /topics/:id (admin detail) — required field-presence', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/topics/7000000000000000800`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertNoLegacyKeys(body)
    assertHasKeys(body.data, TOPIC_REQUIRED_KEYS)
  })
})
