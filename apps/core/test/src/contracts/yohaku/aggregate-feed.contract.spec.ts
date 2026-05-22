/**
 * Yohaku consumer contract: `/aggregate/feed` and `/aggregate/sitemap`.
 *
 * Drives:
 *   - `app/feed/route.tsx:38-78` reads `{author, data, url}` from /feed.
 *     Each `data[]` entry must carry `link` as a FULL URL (used as
 *     `<link>` in the RSS XML) and `created`, `title`, `text`, `images`,
 *     `contentFormat`. The PG cutover left `url: ''` and `link: <slug>`,
 *     which broke RSS readers — locked here.
 *   - `app/sitemap/route.tsx:21-29` reads `data[].url` and
 *     `data[].published_at` (sorted desc).
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

import { assertHasKeys } from '../../../helper/api-shape'
import { createE2EApp } from '../../../helper/create-e2e-app'
import {
  translationEntryProvider,
  translationProvider,
} from '../../../mock/processors/translation.mock'

const stub = <T>(token: T, value: any) => ({
  provide: token as any,
  useValue: value,
})

const aggregateServiceProvider = {
  provide: AggregateService,
  useValue: {
    async buildRssStructure() {
      return {
        title: 'site',
        description: 'd',
        author: 'me',
        url: 'https://example.test',
        data: [
          {
            id: '7000000000000000060',
            title: 'A Post',
            text: 'body',
            link: 'https://example.test/posts/general/a-post',
            created: new Date('2026-04-01T00:00:00.000Z'),
            modified: null,
            images: [],
            contentFormat: 'markdown',
            content: '# body',
          },
        ],
      }
    },
    async getSiteMapContent() {
      return [
        {
          url: 'https://example.test/posts/general/a-post',
          published_at: new Date('2026-04-01T00:00:00.000Z'),
        },
        {
          url: 'https://example.test/notes/7',
          published_at: new Date('2026-03-15T00:00:00.000Z'),
        },
      ]
    },
  },
}

const baseProviders = [
  aggregateServiceProvider,
  translationProvider,
  translationEntryProvider,
  stub(AnalyzeService, {
    async getCallTime() {
      return { callTime: 0, uv: 0 }
    },
    async getTodayAccessIp() {
      return []
    },
  }),
  stub(ConfigsService, {
    async get() {
      return {}
    },
  }),
  stub(NoteService, {
    async getLatestNoteId() {
      return 0
    },
  }),
  stub(OwnerService, {
    async getOwner() {
      return {
        id: '1',
        name: 'me',
        username: 'owner',
        avatar: null,
        socialIds: {},
      }
    },
  }),
  stub(SnippetService, {
    async getCachedSnippet() {
      return null
    },
  }),
]

describe('Yohaku contract — /aggregate/feed and /aggregate/sitemap', () => {
  const proxy = createE2EApp({
    controllers: [AggregateController],
    providers: baseProviders,
  })

  test('GET /aggregate/feed — full URL on root and per-entry link', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/aggregate/feed`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertHasKeys(body.data, ['title', 'description', 'author', 'url', 'data'])
    expect(typeof body.data.url).toBe('string')
    expect(body.data.url.length).toBeGreaterThan(0)
    expect(Array.isArray(body.data.data)).toBe(true)
    const item = body.data.data[0]
    assertHasKeys(item, ['id', 'title', 'link', 'created', 'images'])
    expect(item.link).toMatch(/^https?:\/\//)
  })

  test('GET /aggregate/sitemap — full URL + published_at, sorted desc', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/aggregate/sitemap`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    assertHasKeys(body.data[0], ['url', 'published_at'])
    const a = new Date(body.data[0].published_at).getTime()
    const b = new Date(body.data[1].published_at).getTime()
    expect(a).toBeGreaterThanOrEqual(b)
  })
})
