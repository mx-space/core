/**
 * Yohaku consumer contract: aggregate top + latest + timeline.
 *
 * Drives:
 *   - `apiClient.aggregate.getTop(5)`         — `result.posts/notes/says/recently`
 *     consumed by `RecentWriting.tsx`, `HomePageTimeLine.tsx`,
 *     `HeaderDataConfigureProvider.tsx`.
 *   - `apiClient.aggregate.getTimeline()`     — `result.data.posts[]`,
 *     `result.data.notes[]`. `timeline/page.tsx` reads `post.created`,
 *     `post.title/slug/category/modified`, `note.created/title/nid`.
 *
 * Server emits PG-shape (`created_at`). Yohaku stale `.created` reads listed.
 */
import { describe, expect, test } from 'vitest'

import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { AggregateController } from '~/modules/aggregate/aggregate.controller'
import { AggregateService } from '~/modules/aggregate/aggregate.service'
import { AnalyzeService } from '~/modules/analyze/analyze.service'
import { ConfigsService } from '~/modules/configs/configs.service'
import { NoteService } from '~/modules/note/note.service'
import { OwnerService } from '~/modules/owner/owner.service'
import { SnippetService } from '~/modules/snippet/snippet.service'

import {
  assertHasKeys,
  assertHasKeysDeep,
  assertNoLegacyKeys,
} from '../../../helper/api-shape'
import { createE2EApp } from '../../../helper/create-e2e-app'
import { translationProvider } from '../../../mock/processors/translation.mock'

const fixturePost = (overrides: Record<string, unknown> = {}) => ({
  id: '7000000000000000060',
  title: 'A Post',
  slug: 'a-post',
  text: 'body',
  contentFormat: 'markdown',
  summary: 'sum',
  meta: null,
  tags: [],
  images: [],
  isPublished: true,
  copyright: true,
  pinAt: null,
  pinOrder: null,
  readCount: 1,
  likeCount: 0,
  category: {
    id: '7000000000000000900',
    slug: 'tech',
    name: 'Tech',
    type: 0,
  },
  categoryId: '7000000000000000900',
  related: [],
  createdAt: new Date('2024-02-01T00:00:00.000Z'),
  modifiedAt: null,
  ...overrides,
})

const fixtureNote = (overrides: Record<string, unknown> = {}) => ({
  id: '7000000000000000070',
  nid: 1,
  title: 'A Note',
  slug: null,
  text: 'note body',
  content: null,
  contentFormat: 'markdown',
  meta: null,
  images: [],
  isPublished: true,
  hasPassword: false,
  password: null,
  publicAt: null,
  mood: null,
  weather: null,
  bookmark: false,
  coordinates: null,
  location: null,
  readCount: 0,
  likeCount: 0,
  topicId: null,
  topic: null,
  createdAt: new Date('2024-09-01T00:00:00.000Z'),
  modifiedAt: null,
  ...overrides,
})

const aggregateServiceProvider = {
  provide: AggregateService,
  useValue: {
    async topActivity() {
      return {
        posts: [fixturePost()],
        notes: [fixtureNote()],
        says: [
          {
            id: '7000000000000000300',
            text: 'hi',
            source: null,
            author: 'me',
            createdAt: new Date('2024-09-02T00:00:00.000Z'),
          },
        ],
        recently: [
          {
            id: '7000000000000000400',
            content: 'noted',
            type: 'message',
            metadata: null,
            refType: null,
            refId: null,
            commentsIndex: 0,
            allowComment: true,
            up: 0,
            down: 0,
            modifiedAt: null,
            createdAt: new Date('2024-09-03T00:00:00.000Z'),
          },
        ],
      }
    },
    async getLatest(limit: number, _types?: unknown, combined?: boolean) {
      if (combined) return []
      return { posts: [fixturePost()], notes: [fixtureNote()] }
    },
    async getTimeline() {
      return { posts: [fixturePost()], notes: [fixtureNote()] }
    },
  },
}

const noteSvcProvider = {
  provide: NoteService,
  useValue: {
    async getLatestNoteId() {
      return 1
    },
  },
}

const ownerSvcProvider = {
  provide: OwnerService,
  useValue: {
    async getOwner() {
      return { id: '1', name: 'me', socialIds: {} }
    },
  },
}

const configsSvcProvider = {
  provide: ConfigsService,
  useValue: {
    async get(key: string) {
      if (key === 'url') return { webUrl: 'https://x.test', adminUrl: '' }
      if (key === 'seo') return { title: 'site', description: 'd' }
      if (key === 'commentOptions')
        return { disableComment: false, allowGuestComment: true }
      if (key === 'ai') return { enableSummary: false }
      return {}
    },
  },
}

const analyzeSvcProvider = {
  provide: AnalyzeService,
  useValue: {
    async getCallTime() {
      return {}
    },
    async getTodayAccessIp() {
      return []
    },
  },
}

const snippetSvcProvider = {
  provide: SnippetService,
  useValue: {
    async getCachedSnippet() {
      return null
    },
  },
}

describe('Yohaku contract — aggregate top/latest/timeline (e2e)', () => {
  const proxy = createE2EApp({
    controllers: [AggregateController],
    providers: [
      aggregateServiceProvider,
      noteSvcProvider,
      ownerSvcProvider,
      configsSvcProvider,
      analyzeSvcProvider,
      snippetSvcProvider,
      translationProvider,
    ],
  })

  test('GET /aggregate/top — exposes posts/notes/says/recently with PG keys', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/aggregate/top`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()

    // `recently` legitimately carries `comments_index` + `allow_comment`.
    assertNoLegacyKeys(body, { allowed: ['comments_index', 'allow_comment'] })
    assertHasKeys(body.data, ['posts', 'notes', 'says', 'recently'])
    assertHasKeysDeep(body.data, [
      'posts.0.id',
      'posts.0.title',
      'posts.0.slug',
      'notes.0.id',
      'notes.0.nid',
      'notes.0.title',
      'says.0.id',
      'says.0.text',
    ])
  })

  test('GET /aggregate/latest — split shape exposes posts + notes arrays', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/aggregate/latest`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertNoLegacyKeys(body)
    assertHasKeys(body.data, ['posts', 'notes'])
    assertHasKeysDeep(body.data, ['posts.0.id', 'notes.0.id', 'notes.0.nid'])
  })

  test('GET /aggregate/timeline — wraps `data.posts` + `data.notes`', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/aggregate/timeline`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertNoLegacyKeys(body)
    assertHasKeysDeep(body, [
      'data.posts.0.id',
      'data.posts.0.title',
      'data.posts.0.created_at',
      'data.posts.0.category.slug',
      'data.notes.0.id',
      'data.notes.0.title',
      'data.notes.0.nid',
      'data.notes.0.created_at',
    ])
  })
})
