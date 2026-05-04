import { describe, expect, test } from 'vitest'

import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { AiInsightsService } from '~/modules/ai/ai-insights/ai-insights.service'
import { AiSummaryService } from '~/modules/ai/ai-summary/ai-summary.service'
import { NoteController } from '~/modules/note/note.controller'
import { NoteService } from '~/modules/note/note.service'

import {
  assertHasKeys,
  assertNoLegacyKeys,
  assertPgTimestamps,
} from '../../helper/api-shape'
import { createE2EApp } from '../../helper/create-e2e-app'
import { countingServiceProvider } from '../../mock/processors/counting.mock'
import { translationProvider } from '../../mock/processors/translation.mock'

/**
 * SDK `NoteModel` 之必填键（packages/api-client/models/note.ts）。
 * `topic` 由 controller 视情形附加，不入此基线列。
 */
const EXPECTED_NOTE_MODEL_KEYS = [
  'id',
  'nid',
  'title',
  'slug',
  'text',
  'content',
  'content_format',
  'images',
  'meta',
  'is_published',
  'has_password',
  'public_at',
  'mood',
  'weather',
  'bookmark',
  'coordinates',
  'location',
  'read_count',
  'like_count',
  'topic_id',
  'created_at',
  'modified_at',
]

const fixtureNote = (overrides: Record<string, unknown> = {}) => ({
  id: '7000000000000000020',
  nid: 1,
  title: 'Today',
  slug: null,
  text: 'body',
  content: null,
  contentFormat: 'markdown',
  images: null,
  meta: null,
  isPublished: true,
  hasPassword: false,
  publicAt: null,
  mood: null,
  weather: null,
  bookmark: false,
  coordinates: null,
  location: null,
  readCount: 1,
  likeCount: 0,
  topicId: null,
  createdAt: new Date('2024-02-01T00:00:00.000Z'),
  modifiedAt: null,
  ...overrides,
})

const noteServiceProvider = {
  provide: NoteService,
  useValue: {
    publicNoteQueryCondition: { isPublished: true },
    checkNoteIsSecret() {
      return false
    },
    async checkPasswordToAccess() {
      return true
    },
    async findById(id: string) {
      return fixtureNote({ id })
    },
    async findByNid(nid: number) {
      return fixtureNote({ nid })
    },
    async listPaginated(page = 1, size = 10) {
      return {
        data: [fixtureNote()],
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
    async findByCreatedWindow() {
      return []
    },
    async getLatestOne() {
      return { latest: fixtureNote(), next: null }
    },
    async getTopicRecentUpdate() {
      return new Date('2024-12-01T00:00:00.000Z')
    },
  },
}

const aiSummaryProvider = {
  provide: AiSummaryService,
  useValue: {
    async batchGetSummariesByRefIds() {
      return new Map<string, string>()
    },
  },
}

const aiInsightsProvider = {
  provide: AiInsightsService,
  useValue: {
    async hasInsightsInLang() {
      return false
    },
  },
}

describe('NoteController contract (e2e)', () => {
  const proxy = createE2EApp({
    controllers: [NoteController],
    providers: [
      noteServiceProvider,
      countingServiceProvider,
      translationProvider,
      aiSummaryProvider,
      aiInsightsProvider,
    ],
  })

  test('GET /notes — list, no legacy keys', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/notes`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    assertNoLegacyKeys(body)
    assertPgTimestamps(body.data[0])
  })

  test('GET /notes/:id — detail, no legacy keys', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/notes/7000000000000000020`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertNoLegacyKeys(body)
    assertPgTimestamps(body)
  })

  test('GET /notes/latest — latest note + next, no legacy keys', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/notes/latest`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertNoLegacyKeys(body)
    assertPgTimestamps(body.data)
  })

  test('GET /notes/nid/:nid — detail by nid, no legacy keys', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/notes/nid/1`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertNoLegacyKeys(body)
    assertPgTimestamps(body.data)
  })

  test('GET /notes/list/:id — adjacent list around a note, no legacy keys', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/notes/list/7000000000000000020`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    assertNoLegacyKeys(body)
  })

  test('GET /notes/topics/:id/recent-update — timestamp marker', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/notes/topics/7000000000000000020/recent-update`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertNoLegacyKeys(body)
    expect(body.ts).toBeTruthy()
  })

  test('SDK shape — every NoteModel key present on list rows', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/notes`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertHasKeys(body.data[0], EXPECTED_NOTE_MODEL_KEYS)
  })

  test('SDK shape — every NoteModel key present on detail (by nid)', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/notes/nid/1`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertHasKeys(body.data, EXPECTED_NOTE_MODEL_KEYS)
  })
})
