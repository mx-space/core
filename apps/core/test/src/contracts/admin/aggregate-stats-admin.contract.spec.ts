/**
 * Admin contract for the entire `/aggregate/stat/*` and `/aggregate/site_info`
 * + `/aggregate/count_*` family.
 *
 * Locks the wire contract that admin-vue3 `apps/admin/src/api/aggregate.ts`
 * declares (`PublicationTrend`, `CategoryDistribution`, `TagCloudItem`,
 * `TopArticle`, `CommentActivityItem`, `TrafficSourceData`,
 * `WordCount`, `ReadAndLikeCount`) and Yohaku's
 * `Hero.tsx` reads from `/site_info` (`{postCount, noteCount,
 * totalWordCount, firstPublishDate}`).
 *
 * Each AggregateService method is mocked to a fixed payload of the
 * expected shape; the spec verifies the controller returns the keys
 * the consumers read. If a future commit drops a field, this spec
 * catches it before the dashboard does.
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
import { authPassHeader } from '../../../mock/guard/auth.guard'
import { translationProvider } from '../../../mock/processors/translation.mock'

const stub = <T>(token: T, value: any) => ({
  provide: token as any,
  useValue: value,
})

const aggregateServiceProvider = {
  provide: AggregateService,
  useValue: {
    async getCategoryDistribution() {
      return [
        {
          id: '7000000000000000901',
          name: 'general',
          slug: 'general',
          count: 5,
        },
      ]
    },
    async getTagCloud() {
      return [{ tag: 'typescript', count: 3 }]
    },
    async getPublicationTrend() {
      return [{ date: '2026-04', posts: 2, notes: 1 }]
    },
    async getTopArticles() {
      return [
        {
          id: '7000000000000000060',
          title: 'A Post',
          slug: 'a-post',
          reads: 99,
          likes: 7,
          category: { name: 'general', slug: 'general' },
        },
      ]
    },
    async getCommentActivity() {
      return [{ date: '2026-04-30', count: 4 }]
    },
    async getTrafficSource() {
      return {
        os: [{ name: 'macOS', count: 12 }],
        browser: [{ name: 'Chrome', count: 9 }],
      }
    },
    async getAllReadAndLikeCount() {
      return { totalLikes: 42, totalReads: 100 }
    },
    async getAllSiteWordsCount() {
      return 12345
    },
    async getSiteInfo() {
      return {
        postCount: 8,
        noteCount: 3,
        totalWordCount: 12345,
        firstPublishDate: '2024-01-01T00:00:00.000Z',
      }
    },
  },
}

const baseProviders = [
  aggregateServiceProvider,
  translationProvider,
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
        name: 'Owner',
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

describe('Admin contract — /aggregate/stat & /aggregate/site_info family', () => {
  const proxy = createE2EApp({
    controllers: [AggregateController],
    providers: baseProviders,
  })

  test('GET /aggregate/stat/category-distribution', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/aggregate/stat/category-distribution`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    assertHasKeys(body.data[0], ['id', 'name', 'slug', 'count'])
  })

  test('GET /aggregate/stat/tag-cloud', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/aggregate/stat/tag-cloud`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    assertHasKeys(body.data[0], ['tag', 'count'])
  })

  test('GET /aggregate/stat/publication-trend', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/aggregate/stat/publication-trend`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    assertHasKeys(body.data[0], ['date', 'posts', 'notes'])
  })

  test('GET /aggregate/stat/top-articles', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/aggregate/stat/top-articles`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    assertHasKeys(body.data[0], [
      'id',
      'title',
      'slug',
      'reads',
      'likes',
      'category',
    ])
  })

  test('GET /aggregate/stat/comment-activity', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/aggregate/stat/comment-activity`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    assertHasKeys(body.data[0], ['date', 'count'])
  })

  test('GET /aggregate/stat/traffic-source', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/aggregate/stat/traffic-source`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertHasKeys(body.data, ['os', 'browser'])
    assertHasKeys(body.data.os[0], ['name', 'count'])
    assertHasKeys(body.data.browser[0], ['name', 'count'])
  })

  test('GET /aggregate/count_read_and_like', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/aggregate/count_read_and_like`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertHasKeys(body.data, ['total_likes', 'total_reads'])
    expect(body.data.total_likes).toBe(42)
    expect(body.data.total_reads).toBe(100)
  })

  test('GET /aggregate/count_site_words', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/aggregate/count_site_words`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.count).toBe(12345)
  })

  test('GET /aggregate/site_info', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/aggregate/site_info`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertHasKeys(body.data, [
      'post_count',
      'note_count',
      'total_word_count',
      'first_publish_date',
    ])
    expect(body.data.first_publish_date).toBe('2024-01-01T00:00:00.000Z')
  })
})
