/**
 * Yohaku consumer contract: recently/shorthand list.
 *
 * Drives `apiClient.recently.getList()` consumed by `thinking/item.tsx`:
 *   - `item.id/content/type/metadata/up/down/allowComment/created/modified`
 *   - `item.ref` (joined ref entity — currently NOT populated by server;
 *     Yohaku gates with `!!item.ref` so degraded display is safe)
 */
import { describe, expect, test } from 'vitest'

import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { RecentlyController } from '~/modules/recently/recently.controller'
import { RecentlyService } from '~/modules/recently/recently.service'

import {
  assertHasKeys,
  assertHasKeysDeep,
  assertNoLegacyKeys,
  assertPgTimestamps,
} from '../../../helper/api-shape'
import { createE2EApp } from '../../../helper/create-e2e-app'

const fixtureRecently = (overrides: Record<string, unknown> = {}) => ({
  id: '7000000000000000400',
  content: 'just a thought',
  type: 'message',
  metadata: null,
  refType: null,
  refId: null,
  commentsIndex: 0,
  allowComment: true,
  up: 2,
  down: 0,
  modifiedAt: null,
  createdAt: new Date('2024-04-01T00:00:00.000Z'),
  ...overrides,
})

const fixtureRecentlyWithRef = (overrides: Record<string, unknown> = {}) =>
  fixtureRecently({
    id: '7000000000000000401',
    refId: '7000000000000000050',
    refType: 'post',
    ref: {
      id: '7000000000000000050',
      type: 'post',
      title: 'a post title',
      slug: 'hello-world',
      url: '/posts/general/hello-world',
    },
    ...overrides,
  })

const recentlyServiceProvider = {
  provide: RecentlyService,
  useValue: {
    async getOffset() {
      return [fixtureRecentlyWithRef(), fixtureRecently()]
    },
    async getOne(id: string) {
      return fixtureRecentlyWithRef({ id })
    },
    async getLatestOne() {
      return fixtureRecentlyWithRef()
    },
    async getAll() {
      return [fixtureRecentlyWithRef(), fixtureRecently()]
    },
  },
}

describe('Yohaku contract — recently list (e2e)', () => {
  const proxy = createE2EApp({
    controllers: [RecentlyController],
    providers: [recentlyServiceProvider],
  })

  const allowedRecentlyKeys = ['comments_index', 'allow_comment']

  test('GET /recently — list, exposes thinking-page fields', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/recently`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)

    assertNoLegacyKeys(body, { allowed: allowedRecentlyKeys })
    assertPgTimestamps(body.data[0])

    assertHasKeys(body.data[0], [
      'id',
      'content',
      'type',
      'up',
      'down',
      'comments_index',
      'allow_comment',
      'created_at',
      'modified_at',
    ])
    // `thinking/item.tsx` feeds `commentsIndex` to NumberSmoothTransition,
    // which performs arithmetic on it — undefined would render NaN. The
    // server must always emit a number, even for entries with zero comments.
    expect(typeof body.data[0].comments_index).toBe('number')
  })

  test('GET /recently/:id — single thinking entry', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/recently/7000000000000000400`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertNoLegacyKeys(body, { allowed: allowedRecentlyKeys })
    assertHasKeys(body.data, ['id', 'content', 'up', 'down', 'created_at'])
  })

  test('GET /recently — ref hydrated for rows with refId', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/recently`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    // first row carries an article ref → must surface ref.id + ref.title.
    assertHasKeysDeep(body.data[0], ['ref.id', 'ref.title'])
    // second row has no refId → ref omitted (consumer guards with `!!item.ref`).
    expect(body.data[1].ref).toBeUndefined()
  })
})
