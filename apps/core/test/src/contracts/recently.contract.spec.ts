import { describe, expect, test } from 'vitest'

import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { RecentlyController } from '~/modules/recently/recently.controller'
import { RecentlyService } from '~/modules/recently/recently.service'

import {
  assertHasKeys,
  assertHasKeysDeep,
  assertLowercaseRefType,
  assertNoLegacyKeys,
  assertPgTimestamps,
} from '../../helper/api-shape'
import { createE2EApp } from '../../helper/create-e2e-app'

/**
 * SDK `RecentlyModel` 之必填键（packages/api-client/models/recently.ts）。
 * 每加 SDK 字段须同更，服务端漏返必触此 spec。
 */
const EXPECTED_RECENTLY_MODEL_KEYS = [
  'id',
  'created_at',
  'modified_at',
  'content',
  'type',
  'metadata',
  'ref_type',
  'ref_id',
  'up',
  'down',
  'comments_index',
  'allow_comment',
]

const fixtureRecently = (overrides: Record<string, unknown> = {}) => ({
  id: '7000000000000000040',
  content: 'just a thought',
  refId: null,
  refType: null,
  // recently legitimately exposes these two — test should ALLOW them.
  commentsIndex: 0,
  allowComment: true,
  up: 1,
  down: 0,
  type: null,
  metadata: null,
  createdAt: new Date('2024-04-01T00:00:00.000Z'),
  modifiedAt: null,
  ...overrides,
})

const fixtureRecentlyWithRef = (overrides: Record<string, unknown> = {}) =>
  fixtureRecently({
    id: '7000000000000000041',
    refId: '7000000000000000010',
    refType: 'note',
    ref: {
      id: '7000000000000000010',
      type: 'note',
      title: 'a note title',
      slug: null,
      nid: 42,
      url: '/notes/42',
    },
    ...overrides,
  })

const fixtureRecentlyOrphan = () =>
  fixtureRecently({
    id: '7000000000000000042',
    refId: '7000000000000099999',
    refType: 'post',
    ref: null,
  })

const recentlyServiceProvider = {
  provide: RecentlyService,
  useValue: {
    async getOffset() {
      return [
        fixtureRecentlyWithRef(),
        fixtureRecentlyOrphan(),
        fixtureRecently(),
      ]
    },
    async getOne(id: string) {
      return fixtureRecentlyWithRef({ id })
    },
    async getLatestOne() {
      return fixtureRecentlyWithRef()
    },
    async getAll() {
      return [
        fixtureRecentlyWithRef(),
        fixtureRecentlyOrphan(),
        fixtureRecently(),
      ]
    },
  },
}

describe('RecentlyController contract (e2e)', () => {
  const proxy = createE2EApp({
    controllers: [RecentlyController],
    providers: [recentlyServiceProvider],
  })

  // `comments_index` and `allow_comment` are valid on recently entities only.
  const allowedRecentlyKeys = ['comments_index', 'allow_comment']

  test('GET /recently — list, allows comments_index/allow_comment', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/recently`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    assertNoLegacyKeys(body, { allowed: allowedRecentlyKeys })
    assertPgTimestamps(body.data[0])
    assertLowercaseRefType(body)
  })

  test('GET /recently/:id — detail', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/recently/7000000000000000040`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertNoLegacyKeys(body, { allowed: allowedRecentlyKeys })
    assertPgTimestamps(body.data)
    assertLowercaseRefType(body)
  })

  test('GET /recently/all — full list, no legacy keys', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/recently/all`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    assertNoLegacyKeys(body, { allowed: allowedRecentlyKeys })
    assertPgTimestamps(body.data[0])
    assertLowercaseRefType(body)
  })

  test('GET /recently/latest — single most recent, no legacy keys', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/recently/latest`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertNoLegacyKeys(body, { allowed: allowedRecentlyKeys })
    assertPgTimestamps(body.data)
    assertLowercaseRefType(body)
  })

  test('GET /recently — ref hydrated when refId set; null on orphan', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/recently`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    // first row carries a real ref → must be hydrated with id + title.
    assertHasKeysDeep(body.data[0], ['ref.id', 'ref.title', 'ref.type'])
    // second row's refId points at a deleted/missing target → ref is null
    // (NOT undefined) so consumers may render a degraded label safely.
    expect(body.data[1].ref).toBeNull()
    // third row has no refId at all → ref is omitted entirely.
    expect(body.data[2].ref).toBeUndefined()
  })

  test('GET /recently/:id — detail surfaces ref when refId set', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/recently/7000000000000000041`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertHasKeysDeep(body.data, ['ref.id', 'ref.title', 'ref.type'])
  })

  test('SDK shape — every RecentlyModel key present on list rows', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/recently`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertHasKeys(body.data[0], EXPECTED_RECENTLY_MODEL_KEYS)
  })

  test('SDK shape — every RecentlyModel key present on detail', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/recently/7000000000000000041`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertHasKeys(body.data, EXPECTED_RECENTLY_MODEL_KEYS)
  })
})
