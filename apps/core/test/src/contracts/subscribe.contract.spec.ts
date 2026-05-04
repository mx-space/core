import { describe, expect, test } from 'vitest'

import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { SubscribeController } from '~/modules/subscribe/subscribe.controller'
import { SubscribeService } from '~/modules/subscribe/subscribe.service'

import { assertNoLegacyKeys, assertPgTimestamps } from '../../helper/api-shape'
import { createE2EApp } from '../../helper/create-e2e-app'
import { authPassHeader } from '../../mock/guard/auth.guard'

const fixtureSubscribe = (overrides: Record<string, unknown> = {}) => ({
  id: '7000000000000000060',
  email: 'sub@example.com',
  enabled: true,
  bit: 3,
  cancelToken: 'token',
  createdAt: new Date('2024-06-01T00:00:00.000Z'),
  modifiedAt: null,
  ...overrides,
})

const subscribeServiceProvider = {
  provide: SubscribeService,
  useValue: {
    async list(page = 1, size = 10) {
      return {
        data: [fixtureSubscribe()],
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
    async checkEnable() {
      return true
    },
  },
}

describe('SubscribeController contract (e2e)', () => {
  const proxy = createE2EApp({
    controllers: [SubscribeController],
    providers: [subscribeServiceProvider],
  })

  test('GET /subscribe — admin list, no legacy keys', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/subscribe`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    assertNoLegacyKeys(body)
    assertPgTimestamps(body.data[0])
  })

  test('GET /subscribe/status — public bit-map status, no legacy keys', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/subscribe/status`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertNoLegacyKeys(body)
    expect(typeof body.enable).toBe('boolean')
    expect(body.bit_map).toBeDefined()
  })
})
