import { describe, expect, test } from 'vitest'

import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { ActivityController } from '~/modules/activity/activity.controller'
import { ActivityService } from '~/modules/activity/activity.service'
import { ReaderService } from '~/modules/reader/reader.service'

import { assertNoLegacyKeys } from '../../helper/api-shape'
import { createE2EApp } from '../../helper/create-e2e-app'
import { authPassHeader } from '../../mock/guard/auth.guard'
import { translationProvider } from '../../mock/processors/translation.mock'

const fixtureLikeActivity = (overrides: Record<string, unknown> = {}) => ({
  id: '7000000000000000090',
  type: 'like',
  refId: '7000000000000000010',
  ref: {
    id: '7000000000000000010',
    title: 'Hello',
    slug: 'hello',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
  },
  payload: { type: 'post', id: '7000000000000000010' },
  createdAt: new Date('2024-09-01T00:00:00.000Z'),
  modifiedAt: null,
  ...overrides,
})

const activityServiceProvider = {
  provide: ActivityService,
  useValue: {
    async getLikeActivities(page = 1, size = 10) {
      return {
        data: [fixtureLikeActivity()],
        total: 1,
        currentPage: page,
        totalPage: 1,
        size,
        hasNextPage: false,
        hasPrevPage: false,
        docs: [fixtureLikeActivity()],
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
    async getRecentComment() {
      return []
    },
    async getRecentPublish() {
      return { post: [], note: [], recent: [] }
    },
    async getAllRoomNames() {
      return { rooms: [], roomCount: {} }
    },
    async getLastYearPublication() {
      return { posts: [], notes: [] }
    },
  },
}

const readerServiceProvider = {
  provide: ReaderService,
  useValue: {
    async findReaderInIds() {
      return []
    },
  },
}

describe('ActivityController contract (e2e)', () => {
  const proxy = createE2EApp({
    controllers: [ActivityController],
    providers: [
      activityServiceProvider,
      readerServiceProvider,
      translationProvider,
    ],
  })

  test('GET /activity/likes — admin list, envelope wrapped', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/activity/likes`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect('data' in body).toBe(true)
    assertNoLegacyKeys(body)
  })

  test('GET /activity/recent — public composite feed, envelope wrapped', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/activity/recent`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertNoLegacyKeys(body)
    expect(Array.isArray(body.data.like)).toBe(true)
    expect(Array.isArray(body.data.post)).toBe(true)
    expect(Array.isArray(body.data.note)).toBe(true)
  })

  test('GET /activity/online-count — totals, envelope wrapped', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/activity/online-count`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertNoLegacyKeys(body)
    expect(typeof body.data.total).toBe('number')
  })

  test('GET /activity/last-year/publication — yearly buckets, envelope wrapped', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/activity/last-year/publication`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertNoLegacyKeys(body)
    expect(Array.isArray(body.data.posts)).toBe(true)
    expect(Array.isArray(body.data.notes)).toBe(true)
  })
})
