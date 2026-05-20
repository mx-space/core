/**
 * Admin contract: GET /aggregate/stat.
 *
 * Drives both consumers' dashboards:
 *   - admin-vue3 `views/dashboard/index.tsx` reads
 *     `stat.value.{todayOnlineTotal, todayMaxOnline, allComments, posts,
 *     notes, pages, says, comments, links, linkApply, recently, online,
 *     unreadComments, callTime, uv, todayIpAccessCount}`
 *   - Yohaku `components/modules/dashboard/home/DataStat.tsx` reads
 *     `stat.{online, todayOnlineTotal, todayMaxOnline}`
 *
 * The PG cutover dropped `says`, `allComments`, `linkApply`, `online`,
 * `todayMaxOnline`, `todayOnlineTotal`, and renamed `recently` to
 * `recentlies`, also flipping `links` semantics
 * (was `LinkState.Pass`, became `LinkState.Audit`). This spec locks the
 * full shape so the regression cannot recur.
 */
import type { AggregateStat } from '@mx-space/api-client'
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

// SDK `AggregateStat`-shaped fixture. The `satisfies AggregateStat` clause
// is the static lock: removing a field from the SDK type or returning a
// different shape from the service mock surfaces as a TS error here.
const STAT_FIXTURE = {
  posts: 1,
  notes: 2,
  pages: 3,
  says: 4,
  comments: 5,
  allComments: 7,
  unreadComments: 1,
  links: 2,
  linkApply: 1,
  categories: 3,
  recently: 4,
  online: 6,
  todayMaxOnline: '8',
  todayOnlineTotal: '12',
  callTime: 99,
  uv: 17,
  todayIpAccessCount: 5,
} satisfies AggregateStat

const EXPECTED_AGGREGATE_STAT_KEYS = [
  'posts',
  'notes',
  'pages',
  'says',
  'comments',
  'all_comments',
  'unread_comments',
  'links',
  'link_apply',
  'categories',
  'recently',
  'online',
  'today_max_online',
  'today_online_total',
  'call_time',
  'uv',
  'today_ip_access_count',
]

const aggregateServiceProvider = {
  provide: AggregateService,
  useValue: {
    async getCounts() {
      const {
        callTime: _callTime,
        uv: _uv,
        todayIpAccessCount: _todayIpAccessCount,
        ...counts
      } = STAT_FIXTURE
      return counts
    },
  },
}

const analyzeSvcProvider = {
  provide: AnalyzeService,
  useValue: {
    async getCallTime() {
      return { callTime: STAT_FIXTURE.callTime, uv: STAT_FIXTURE.uv }
    },
    async getTodayAccessIp() {
      return Array.from({ length: STAT_FIXTURE.todayIpAccessCount }, () => '1')
    },
  },
}

const stubProvider = <T>(token: T, value: any) => ({
  provide: token as any,
  useValue: value,
})

describe('Admin contract — GET /aggregate/stat (e2e)', () => {
  const proxy = createE2EApp({
    controllers: [AggregateController],
    providers: [
      aggregateServiceProvider,
      analyzeSvcProvider,
      translationProvider,
      stubProvider(ConfigsService, {
        async get() {
          return {}
        },
      }),
      stubProvider(NoteService, {
        async getLatestNoteId() {
          return 0
        },
      }),
      stubProvider(OwnerService, {
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
      stubProvider(SnippetService, {
        async getCachedSnippet() {
          return null
        },
      }),
    ],
  })

  test('returns every key admin/Yohaku dashboards consume', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/aggregate/stat`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()

    assertHasKeys(body.data, EXPECTED_AGGREGATE_STAT_KEYS)
    expect(body.data.recently).toBe(STAT_FIXTURE.recently)
    expect(body.data.online).toBe(STAT_FIXTURE.online)
    expect(body.data.today_max_online).toBe(STAT_FIXTURE.todayMaxOnline)
    expect(body.data.today_online_total).toBe(STAT_FIXTURE.todayOnlineTotal)
    expect(body.data.all_comments).toBe(STAT_FIXTURE.allComments)
    expect(body.data.link_apply).toBe(STAT_FIXTURE.linkApply)
    expect(body.data.today_ip_access_count).toBe(
      STAT_FIXTURE.todayIpAccessCount,
    )
  })
})
