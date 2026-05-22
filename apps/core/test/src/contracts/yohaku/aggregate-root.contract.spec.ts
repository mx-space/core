/**
 * Yohaku consumer contract: aggregate root (`/aggregate`).
 *
 * Drives `apiClient.aggregate.getAggregateData('shiro')` consumed by
 * `aggregation-data-provider.tsx` + `pageExtra.tsx`:
 *   - `state.user.{name,id,socialIds}`
 *   - `state.url.webUrl`
 *   - `state.seo`
 *   - `state.commentOptions.{disableComment,allowGuestComment}`
 *   - `state.latestNoteId`
 *   - `state.theme`
 *   - `state.ai.enableSummary`
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
import {
  translationEntryProvider,
  translationProvider,
} from '../../../mock/processors/translation.mock'

const aggregateServiceProvider = {
  provide: AggregateService,
  useValue: {},
}

const noteSvcProvider = {
  provide: NoteService,
  useValue: {
    async getLatestNoteId() {
      return 17
    },
  },
}

const ownerSvcProvider = {
  provide: OwnerService,
  useValue: {
    async getOwner() {
      return {
        id: '1',
        name: 'Owner',
        username: 'owner',
        avatar: null,
        introduce: 'hi',
        socialIds: { github: 'innei' },
      }
    },
  },
}

const configsSvcProvider = {
  provide: ConfigsService,
  useValue: {
    async get(key: string) {
      if (key === 'url') return { webUrl: 'https://x.test', adminUrl: 'admin' }
      if (key === 'seo') return { title: 'site', description: 'd' }
      if (key === 'commentOptions')
        return { disableComment: false, allowGuestComment: true }
      if (key === 'ai') return { enableSummary: true }
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

describe('Yohaku contract — aggregate root (e2e)', () => {
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
      translationEntryProvider,
    ],
  })

  test('GET /aggregate — exposes Yohaku-required top-level keys', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/aggregate`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()

    assertNoLegacyKeys(body)
    assertHasKeys(body.data, [
      'user',
      'seo',
      'url',
      'comment_options',
      'latest_note_id',
      'ai',
    ])
    assertHasKeysDeep(body.data, [
      'user.id',
      'user.name',
      'url.web_url',
      'comment_options.disable_comment',
      'comment_options.allow_guest_comment',
      'ai.enable_summary',
    ])
  })

  test('GET /aggregate/site — exposes user/url/seo subset', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/aggregate/site`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertNoLegacyKeys(body)
    assertHasKeys(body.data, ['user', 'seo', 'url'])
    assertHasKeysDeep(body.data, ['user.id', 'user.name', 'url.web_url'])
  })
})
