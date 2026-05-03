/**
 * Yohaku consumer contract: note detail.
 *
 * Drives `apiClient.note.getNoteByNid(nid)` consumed by:
 *   - `app/[locale]/notes/(note-detail)/detail-page.tsx` — `data.id/nid/title/
 *     images/meta/topic/translationMeta/contentFormat/content/text/
 *     allowComment/isPublished`, `notePayload.next.nid`, `notePayload.prev.nid`
 *   - `pageExtra.tsx`            — `data.created/modified/topic/weather/mood/
 *                                  count.{read,like}/publicAt`
 *   - `NoteFooterNavigation*`    — `data.next.{nid,slug,title,created}`,
 *                                  `data.prev.{...}`
 *
 * Server now wraps `{ data, next, prev }` with PG-shape inside `data`.
 */
import { describe, expect, test } from 'vitest'

import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { AiInsightsService } from '~/modules/ai/ai-insights/ai-insights.service'
import { AiSummaryService } from '~/modules/ai/ai-summary/ai-summary.service'
import { NoteController } from '~/modules/note/note.controller'
import { NoteService } from '~/modules/note/note.service'

import {
  assertHasKeys,
  assertHasKeysDeep,
  assertNoLegacyKeys,
  assertPgTimestamps,
} from '../../../helper/api-shape'
import { createE2EApp } from '../../../helper/create-e2e-app'
import { countingServiceProvider } from '../../../mock/processors/counting.mock'
import { translationProvider } from '../../../mock/processors/translation.mock'

const fixtureNote = (overrides: Record<string, unknown> = {}) => ({
  id: '7000000000000000070',
  nid: 42,
  title: 'A Note',
  slug: 'a-note',
  text: 'note body',
  content: null,
  contentFormat: 'markdown',
  meta: { cover: 'https://x/c.png', banner: null },
  images: [{ src: 'https://x/c.png', accent: '#abc' }],
  isPublished: true,
  hasPassword: false,
  password: null,
  publicAt: null,
  mood: 'calm',
  weather: 'sunny',
  bookmark: false,
  coordinates: null,
  location: null,
  readCount: 9,
  likeCount: 4,
  topicId: '7000000000000000080',
  topic: {
    id: '7000000000000000080',
    name: 'OSS',
    slug: 'oss',
    description: 'd',
    introduce: 'i',
    icon: null,
    createdAt: new Date('2024-08-01T00:00:00.000Z'),
  },
  createdAt: new Date('2024-09-01T00:00:00.000Z'),
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
    async findByCreatedWindow(_pivot: Date, direction: string) {
      return [
        direction === 'after'
          ? {
              id: '7000000000000000069',
              nid: 41,
              slug: 'prev-note',
              title: 'Prev Note',
              createdAt: new Date('2024-08-30T00:00:00.000Z'),
            }
          : {
              id: '7000000000000000071',
              nid: 43,
              slug: 'next-note',
              title: 'Next Note',
              createdAt: new Date('2024-09-02T00:00:00.000Z'),
            },
      ]
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

describe('Yohaku contract — note detail (e2e)', () => {
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

  test('GET /notes/nid/:nid — wrapped payload exposes Yohaku-required fields', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/notes/nid/42`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()

    assertNoLegacyKeys(body)
    expect(body.data).toBeTruthy()
    assertPgTimestamps(body.data)

    assertHasKeys(body.data, [
      'id',
      'nid',
      'title',
      'slug',
      'text',
      'content_format',
      'meta',
      'images',
      'is_published',
      'mood',
      'weather',
      'bookmark',
      'public_at',
      'read_count',
      'like_count',
      'topic_id',
      'created_at',
      'modified_at',
    ])

    // Topic is consumed as an object: `data.topic?.name`, `data.topic?.icon`.
    if (body.data.topic) {
      assertHasKeysDeep(body.data, ['topic.name', 'topic.slug'])
    }

    // Adjacency wrappers carry partial note shape.
    if (body.next) {
      assertHasKeys(body.next, ['nid', 'title', 'slug', 'id'])
    }
    if (body.prev) {
      assertHasKeys(body.prev, ['nid', 'title', 'slug', 'id'])
    }
  })
})
