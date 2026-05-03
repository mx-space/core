/**
 * Yohaku consumer contract: topic list + by-slug.
 *
 * Drives:
 *   - `apiClient.topic.getAll()` — `data[].id/name/slug/icon/introduce`
 *   - `apiClient.topic.getTopicBySlug(slug)` — `topic.id/name/slug/icon/
 *     introduce/description`
 */
import { describe, expect, test } from 'vitest'

import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { TopicBaseController } from '~/modules/topic/topic.controller'
import { TopicRepository } from '~/modules/topic/topic.repository'

import {
  assertHasKeys,
  assertNoLegacyKeys,
  assertPgTimestamps,
} from '../../../helper/api-shape'
import { createE2EApp } from '../../../helper/create-e2e-app'
import { eventEmitterProvider } from '../../../mock/processors/event.mock'

const fixtureTopic = (overrides: Record<string, unknown> = {}) => ({
  id: '7000000000000000080',
  name: 'OSS',
  slug: 'oss',
  description: 'long-form prose about open source',
  introduce: 'short intro',
  icon: 'https://x/icon.png',
  createdAt: new Date('2024-08-01T00:00:00.000Z'),
  modifiedAt: null,
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
    async findById() {
      return fixtureTopic()
    },
    async findBySlug(slug: string) {
      return fixtureTopic({ slug })
    },
  },
}

describe('Yohaku contract — topic detail (e2e)', () => {
  const proxy = createE2EApp({
    controllers: [TopicBaseController],
    providers: [topicRepoProvider, ...eventEmitterProvider],
  })

  test('GET /topics/all — list, exposes Yohaku-required topic fields', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/topics/all`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    assertNoLegacyKeys(body)
    assertPgTimestamps(body.data[0])
    assertHasKeys(body.data[0], ['id', 'name', 'slug', 'icon', 'introduce'])
  })

  test('GET /topics/slug/:slug — single topic, exposes detail fields', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/topics/slug/oss`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertNoLegacyKeys(body)
    assertPgTimestamps(body)
    assertHasKeys(body, [
      'id',
      'name',
      'slug',
      'description',
      'introduce',
      'icon',
    ])
  })
})
