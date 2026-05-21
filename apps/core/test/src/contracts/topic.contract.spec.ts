import { describe, expect, test } from 'vitest'

import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { TopicBaseController } from '~/modules/topic/topic.controller'
import { TopicRepository } from '~/modules/topic/topic.repository'
import { TranslationService } from '~/processors/helper/helper.translation.service'

import { assertNoLegacyKeys, assertPgTimestamps } from '../../helper/api-shape'
import { createE2EApp } from '../../helper/create-e2e-app'
import { eventEmitterProvider } from '../../mock/processors/event.mock'

const fixtureTopic = (overrides: Record<string, unknown> = {}) => ({
  id: '7000000000000000080',
  name: 'OSS',
  slug: 'oss',
  description: null,
  introduce: null,
  icon: null,
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
    async findBySlug() {
      return fixtureTopic()
    },
    async create(input: any) {
      return fixtureTopic(input)
    },
    async update(id: any, patch: any) {
      return fixtureTopic({ id, ...patch })
    },
    async deleteById() {
      return fixtureTopic()
    },
  },
}

const translationServiceProvider = {
  provide: TranslationService,
  useValue: {
    getTopicTranslationFields: async () => new Map(),
  },
}

describe('TopicController contract (e2e)', () => {
  const proxy = createE2EApp({
    controllers: [TopicBaseController],
    providers: [
      topicRepoProvider,
      translationServiceProvider,
      ...eventEmitterProvider,
    ],
  })

  test('GET /topics — list, no legacy keys', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/topics`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    assertNoLegacyKeys(body)
    assertPgTimestamps(body.data[0])
  })

  test('GET /topics/all — flat list, no legacy keys', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/topics/all`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    assertNoLegacyKeys(body)
    assertPgTimestamps(body.data[0])
  })

  test('GET /topics/slug/:slug — by slug, no legacy keys', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/topics/slug/oss`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertNoLegacyKeys(body)
    assertPgTimestamps(body.data)
  })

  test('GET /topics/:id — by id, no legacy keys', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/topics/7000000000000000080`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertNoLegacyKeys(body)
    assertPgTimestamps(body.data)
  })
})
