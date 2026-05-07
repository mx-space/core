import { describe, expect, test } from 'vitest'

import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { AiInsightsService } from '~/modules/ai/ai-insights/ai-insights.service'
import { AiSummaryService } from '~/modules/ai/ai-summary/ai-summary.service'
import { NoteController } from '~/modules/note/note.controller'
import { NoteService } from '~/modules/note/note.service'
import { LexicalService } from '~/processors/helper/helper.lexical.service'

import {
  assertHasKeys,
  assertNoLegacyKeys,
  assertPgTimestamps,
} from '../../helper/api-shape'
import { createE2EApp } from '../../helper/create-e2e-app'
import { enrichmentProvider } from '../../mock/modules/enrichment.mock'
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

// Test-controlled state: per-test overrides for the published flag exposed by
// `findByNid`, plus a captured-options ledger so we can assert that the
// controller forwards `?year=` to `listPaginated`.
const noteState = {
  byNidIsPublished: true,
  listPaginatedCalls: [] as Array<Record<string, unknown>>,
  reset() {
    this.byNidIsPublished = true
    this.listPaginatedCalls = []
  },
}

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
      return fixtureNote({ nid, isPublished: noteState.byNidIsPublished })
    },
    async listPaginated(
      page = 1,
      size = 10,
      options: Record<string, unknown> = {},
    ) {
      noteState.listPaginatedCalls.push(options)
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

const lexicalServiceProvider = {
  provide: LexicalService,
  useValue: {
    extractSummaryFromLexical(
      _content: string,
      _maxLength = 150,
    ): string | null {
      return null
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
      enrichmentProvider,
      aiSummaryProvider,
      aiInsightsProvider,
      lexicalServiceProvider,
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

  test('GET /notes/nid/:nid — unauthenticated + unpublished → 404', async () => {
    noteState.byNidIsPublished = false
    try {
      const res = await proxy.app.inject({
        method: 'GET',
        url: `${apiRoutePrefix}/notes/nid/1`,
      })
      expect(res.statusCode).toBe(404)
    } finally {
      noteState.reset()
    }
  })

  test('GET /notes?year=2024 — pushes year into listPaginated', async () => {
    noteState.reset()
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/notes?year=2024`,
    })
    expect(res.statusCode).toBe(200)
    expect(noteState.listPaginatedCalls.length).toBeGreaterThan(0)
    const lastCall = noteState.listPaginatedCalls.at(-1)!
    expect(lastCall.year).toBe(2024)
  })

  test('GET /notes/list/:id — items expose only NoteTimelineItem keys', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/notes/list/7000000000000000020`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data.length).toBeGreaterThan(0)
    const item = body.data[0]
    // SDK NoteTimelineItem = Pick<NoteModel, 'id' | 'title' | 'nid' | 'slug'
    //                                       | 'createdAt' | 'isPublished'>
    assertHasKeys(item, [
      'id',
      'title',
      'nid',
      'slug',
      'created_at',
      'is_published',
    ])
    // Heavy fields must NOT leak — old impl returned the full row which on
    // even a moderately-sized timeline blew up the payload.
    expect(item.text).toBeUndefined()
    expect(item.content).toBeUndefined()
    expect(item.images).toBeUndefined()
    expect(item.location).toBeUndefined()
    expect(item.coordinates).toBeUndefined()
  })

  test('GET /notes?withSummary=1 — applyNoteSelect preserves injected summary', async () => {
    noteState.reset()
    const res = await proxy.app.inject({
      method: 'GET',
      // Include a `select` that omits `summary` — this is exactly Yohaku's
      // call shape (`NoteListItemPaper` consumer). Before the fix
      // `applyNoteSelect` stripped the summary that `enrichDocsWithSummary`
      // had just injected.
      url: `${apiRoutePrefix}/notes?withSummary=1&select=title%20id`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data[0].summary).toBeDefined()
    // Fixture text is 'body'; fallback is `text.slice(0,150)`.
    expect(body.data[0].summary).toBe('body')
  })
})
