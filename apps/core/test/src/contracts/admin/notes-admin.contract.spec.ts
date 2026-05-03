/**
 * Admin field-presence contract for /notes endpoints.
 *
 * The dashboard list (`apps/admin/src/views/manage-notes/list.tsx`) reads
 * `row.id`, `row.nid`, `row.title`, `row.slug`, `row.bookmark`, `row.mood`,
 * `row.weather`, `row.public_at`, `row.location`, `row.coordinates`,
 * `row.read_count`, `row.like_count`, `row.is_published`, `row.created_at`,
 * `row.modified_at`. The detail/write/topic page additionally reads
 * `text`, `content`, `content_format`, `meta`, `images`, `password`,
 * `has_password`, `topic_id`, `topic`.
 *
 * `nid` is critical — admin builds the public URL as `/notes/${row.nid}`
 * when no slug is set, so a missing `nid` produces a broken external link.
 */
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
} from '../../../helper/api-shape'
import { createE2EApp } from '../../../helper/create-e2e-app'
import { authPassHeader } from '../../../mock/guard/auth.guard'
import { countingServiceProvider } from '../../../mock/processors/counting.mock'
import { translationProvider } from '../../../mock/processors/translation.mock'

const fixtureNote = (overrides: Record<string, unknown> = {}) => ({
  id: '7000000000000000020',
  nid: 42,
  title: 'My Day',
  slug: 'my-day',
  text: 'note body',
  content: null,
  contentFormat: 'markdown',
  images: [],
  meta: null,
  isPublished: true,
  hasPassword: false,
  password: null,
  publicAt: null,
  mood: 'happy',
  weather: 'sunny',
  bookmark: true,
  coordinates: { latitude: 31.23, longitude: 121.47 },
  location: 'Shanghai',
  readCount: 11,
  likeCount: 5,
  topicId: '7000000000000000800',
  topic: {
    id: '7000000000000000800',
    name: 'Daily',
    slug: 'daily',
  },
  createdAt: new Date('2024-04-15T00:00:00.000Z'),
  modifiedAt: null,
  ...overrides,
})

const noteServiceProvider = {
  provide: NoteService,
  useValue: {
    publicNoteQueryCondition: {},
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
    async findById(id: string) {
      return fixtureNote({ id })
    },
    async findByNid(nid: number) {
      return fixtureNote({ nid })
    },
    async findOneByDateAndSlug() {
      return fixtureNote()
    },
    async findOneByIdOrNid(id: string) {
      return fixtureNote({ id })
    },
    async findByCreatedWindow() {
      return []
    },
    async getNotePaginationByTopicId(_id: string, opts: any = {}) {
      const page = opts.page ?? 1
      const size = opts.limit ?? 10
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
    async getTopicRecentUpdate() {
      return null
    },
    async getLatestOne() {
      return null
    },
    checkNoteIsSecret() {
      return false
    },
    async checkPasswordToAccess() {
      return true
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

const NOTE_LIST_REQUIRED_KEYS = [
  'id',
  'nid',
  'title',
  'slug',
  'bookmark',
  'mood',
  'weather',
  'public_at',
  'location',
  'coordinates',
  'read_count',
  'like_count',
  'is_published',
  'created_at',
  'modified_at',
]

const NOTE_DETAIL_REQUIRED_KEYS = [
  ...NOTE_LIST_REQUIRED_KEYS,
  'text',
  'content',
  'content_format',
  'meta',
  'images',
  'has_password',
  'topic_id',
]

describe('NoteController admin contract (e2e)', () => {
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

  test('GET /notes (admin list) — required field-presence', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/notes`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    assertNoLegacyKeys(body)
    const item = body.data[0]
    assertPgTimestamps(item)
    assertHasKeys(item, NOTE_LIST_REQUIRED_KEYS)
  })

  test('GET /notes/:id (admin detail) — required field-presence', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/notes/7000000000000000020`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertNoLegacyKeys(body)
    assertPgTimestamps(body)
    assertHasKeys(body, NOTE_DETAIL_REQUIRED_KEYS)
  })

  test('GET /notes/topics/:id (admin topic feed) — paginates with required list keys', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/notes/topics/7000000000000000800`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    assertNoLegacyKeys(body)
    assertHasKeys(body.data[0], NOTE_LIST_REQUIRED_KEYS)
  })
})
