import { describe, expect, test } from 'vitest'

import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { DraftController } from '~/modules/draft/draft.controller'
import { DraftService } from '~/modules/draft/draft.service'

import {
  assertLowercaseRefType,
  assertNoLegacyKeys,
  assertPgTimestamps,
} from '../../helper/api-shape'
import { createE2EApp } from '../../helper/create-e2e-app'
import { authPassHeader } from '../../mock/guard/auth.guard'

const fixtureDraft = (overrides: Record<string, unknown> = {}) => ({
  id: '7000000000000000030',
  title: 'WIP',
  text: 'draft body',
  content: null,
  contentFormat: 'markdown',
  refType: 'post',
  refId: '7000000000000000010',
  hasRef: true,
  version: 1,
  publishedVersion: 0,
  history: [],
  meta: null,
  typeSpecificData: null,
  createdAt: new Date('2024-03-01T00:00:00.000Z'),
  modifiedAt: null,
  ...overrides,
})

const draftServiceProvider = {
  provide: DraftService,
  useValue: {
    async list() {
      return {
        data: [fixtureDraft()],
        pagination: {
          total: 1,
          currentPage: 1,
          totalPage: 1,
          size: 10,
          hasNextPage: false,
          hasPrevPage: false,
        },
      }
    },
    async count() {
      return 1
    },
    async findById(id: string) {
      return fixtureDraft({ id })
    },
    async findByRef() {
      return fixtureDraft()
    },
    async findNewDrafts() {
      return [fixtureDraft({ refId: null, hasRef: false })]
    },
    async getHistory() {
      return [{ version: 1, savedAt: new Date('2024-03-02T00:00:00.000Z') }]
    },
  },
}

describe('DraftController contract (e2e)', () => {
  const proxy = createE2EApp({
    controllers: [DraftController],
    providers: [draftServiceProvider],
  })

  test('GET /drafts list — no legacy keys, lowercase ref_type', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/drafts`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    assertNoLegacyKeys(body)
    assertPgTimestamps(body.data[0])
    assertLowercaseRefType(body)
  })

  test('GET /drafts/:id detail — no legacy keys, lowercase ref_type', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/drafts/7000000000000000030`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertNoLegacyKeys(body)
    assertPgTimestamps(body.data)
    assertLowercaseRefType(body)
  })

  test('GET /drafts/by-ref/:refType/:refId — bound draft, lowercase ref_type', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/drafts/by-ref/post/7000000000000000010`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertNoLegacyKeys(body)
    assertPgTimestamps(body.data)
    assertLowercaseRefType(body)
  })

  test('GET /drafts/by-ref/:refType/new — unbound drafts list, lowercase ref_type', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/drafts/by-ref/post/new`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    assertNoLegacyKeys(body)
    assertPgTimestamps(body.data[0])
    assertLowercaseRefType(body)
  })
})
