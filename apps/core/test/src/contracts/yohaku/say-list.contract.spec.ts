/**
 * Yohaku consumer contract: say list.
 *
 * Drives `apiClient.say.getAllPaginated()` consumed by:
 *   - `SayMasonry.tsx`     — `say.id/text/source/author/created`
 *   - `says/feed/route.tsx` — `say.created/text`
 *   - `BottomSection.tsx`  — `musings[0].created/text/...`
 */
import { describe, expect, test } from 'vitest'

import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { SayController } from '~/modules/say/say.controller'
import { SayRepository } from '~/modules/say/say.repository'

import {
  assertHasKeys,
  assertNoLegacyKeys,
  assertPgTimestamps,
} from '../../../helper/api-shape'
import { createE2EApp } from '../../../helper/create-e2e-app'
import { eventEmitterProvider } from '../../../mock/processors/event.mock'

const fixtureSay = (overrides: Record<string, unknown> = {}) => ({
  id: '7000000000000000300',
  text: 'A short musing.',
  source: 'me',
  author: 'innei',
  createdAt: new Date('2024-09-15T00:00:00.000Z'),
  modifiedAt: null,
  ...overrides,
})

const sayRepoProvider = {
  provide: SayRepository,
  useValue: {
    async list(page = 1, size = 10) {
      return {
        data: [fixtureSay()],
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
      return [fixtureSay()]
    },
    async findById() {
      return fixtureSay()
    },
  },
}

describe('Yohaku contract — say list (e2e)', () => {
  const proxy = createE2EApp({
    controllers: [SayController],
    providers: [sayRepoProvider, ...eventEmitterProvider],
  })

  test('GET /says — list, exposes Yohaku-required say fields', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/says`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    assertNoLegacyKeys(body)
    assertPgTimestamps(body.data[0])
    assertHasKeys(body.data[0], [
      'id',
      'text',
      'source',
      'author',
      'created_at',
    ])
  })

  test('GET /says/random — single random entry', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/says/random`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertNoLegacyKeys(body)
    expect(body.data).toBeTruthy()
    assertHasKeys(body.data, ['id', 'text', 'created_at'])
  })
})
