/**
 * Admin field-presence contract for /drafts endpoints.
 *
 * Dashboard drafts list/edit/history (`apps/admin/src/views/drafts/*`,
 * `apps/admin/src/api/drafts.ts`) reads `draft.id`, `draft.ref_type`,
 * `draft.ref_id`, `draft.title`, `draft.text`, `draft.content`,
 * `draft.content_format`, `draft.version`, `draft.created_at`,
 * `draft.updated_at`, `draft.history`, `draft.type_specific_data`.
 *
 * Drafts use `updated_at` (not `modified_at`) as the mutation timestamp,
 * so this spec does not invoke `assertPgTimestamps`.
 */
import { describe, expect, test } from 'vitest'

import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { DraftController } from '~/modules/draft/draft.controller'
import { DraftService } from '~/modules/draft/draft.service'

import {
  assertHasKeys,
  assertLowercaseRefType,
  assertNoLegacyKeys,
} from '../../../helper/api-shape'
import { createE2EApp } from '../../../helper/create-e2e-app'
import { authPassHeader } from '../../../mock/guard/auth.guard'

const fixtureDraft = (overrides: Record<string, unknown> = {}) => ({
  id: '7000000000000000030',
  refType: 'post',
  refId: '7000000000000000010',
  title: 'WIP',
  text: 'draft body',
  content: null,
  contentFormat: 'markdown',
  images: [],
  meta: null,
  typeSpecificData: { categoryId: '7000000000000000900' },
  history: [],
  version: 1,
  publishedVersion: 0,
  createdAt: new Date('2024-03-01T00:00:00.000Z'),
  updatedAt: new Date('2024-03-02T00:00:00.000Z'),
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
      return [fixtureDraft({ refId: null })]
    },
    async getHistory() {
      return []
    },
    async getHistoryVersion() {
      return fixtureDraft()
    },
  },
}

const DRAFT_REQUIRED_KEYS = [
  'id',
  'ref_type',
  'ref_id',
  'title',
  'text',
  'content',
  'content_format',
  'version',
  'history',
  'type_specific_data',
  'created_at',
  'updated_at',
]

describe('DraftController admin contract (e2e)', () => {
  const proxy = createE2EApp({
    controllers: [DraftController],
    providers: [draftServiceProvider],
  })

  test('GET /drafts (admin list) — required field-presence', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/drafts`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    assertNoLegacyKeys(body)
    assertLowercaseRefType(body)
    assertHasKeys(body.data[0], DRAFT_REQUIRED_KEYS)
  })

  test('GET /drafts/:id (admin detail) — required field-presence', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/drafts/7000000000000000030`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertNoLegacyKeys(body)
    assertLowercaseRefType(body)
    assertHasKeys(body.data, DRAFT_REQUIRED_KEYS)
  })
})
