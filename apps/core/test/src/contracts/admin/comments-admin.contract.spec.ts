/**
 * Admin field-presence contract for /comments endpoints.
 *
 * The dashboard list (`apps/admin/src/views/comments/components/comment-list-item.tsx`)
 * reads `comment.id`, `comment.author`, `comment.text`, `comment.avatar`,
 * `comment.created_at`, `comment.parent_comment_id`, `comment.is_whispers`,
 * `comment.is_deleted`. The detail panel (`comment-detail.tsx`) additionally
 * dereferences `mail`, `url`, `ip`, `agent`, `state`, `ref_type`, `edited_at`,
 * `reply_count`, `latest_reply_at`, and — for replies — `parent.author`,
 * `parent.text`, `parent.is_deleted`. Comment rows have NO `modified_at`
 * (only `edited_at`) — `assertPgTimestamps` is therefore not used here.
 */
import { describe, expect, test } from 'vitest'

import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { CommentController } from '~/modules/comment/comment.controller'
import { CommentLifecycleService } from '~/modules/comment/comment.lifecycle.service'
import { CommentService } from '~/modules/comment/comment.service'
import { ConfigsService } from '~/modules/configs/configs.service'
import { EntitlementService } from '~/modules/membership/entitlement.service'
import { ReaderService } from '~/modules/reader/reader.service'

import {
  assertHasKeys,
  assertHasKeysDeep,
  assertLowercaseRefType,
  assertNoLegacyKeys,
} from '../../../helper/api-shape'
import { createE2EApp } from '../../../helper/create-e2e-app'
import { authPassHeader } from '../../../mock/guard/auth.guard'
import { eventEmitterProvider } from '../../../mock/processors/event.mock'

const POST_REF = {
  id: '7000000000000000010',
  type: 'post',
  title: 'a post title',
  slug: 'hello-world',
  category: { name: 'general', slug: 'general' },
}

const NOTE_REF = {
  id: '7000000000000000020',
  type: 'note',
  title: 'a note title',
  slug: null,
  nid: 7,
}

const fixtureComment = (overrides: Record<string, unknown> = {}) => ({
  id: '7000000000000000100',
  author: 'guest',
  text: 'nice post',
  mail: 'g@example.com',
  url: null,
  avatar: null,
  state: 0,
  pin: false,
  isWhispers: false,
  isDeleted: false,
  refId: '7000000000000000010',
  refType: 'post',
  parentCommentId: null,
  rootCommentId: null,
  replyCount: 0,
  latestReplyAt: null,
  editedAt: null,
  deletedAt: null,
  readerId: null,
  ip: '127.0.0.1',
  agent: 'Mozilla/5.0',
  location: null,
  anchor: null,
  meta: null,
  authProvider: null,
  createdAt: new Date('2024-10-01T00:00:00.000Z'),
  ref: POST_REF,
  // Root rows still emit `parent: null` so the dashboard does not have to
  // distinguish between "no parent" (key present, null) and "key missing".
  parent: null,
  ...overrides,
})

const fixtureCommentForNote = () =>
  fixtureComment({
    id: '7000000000000000101',
    refId: '7000000000000000020',
    refType: 'note',
    ref: NOTE_REF,
  })

const fixtureCommentOrphan = () =>
  fixtureComment({
    id: '7000000000000000102',
    refId: '7000000000000099999',
    refType: 'post',
    ref: null,
  })

const PARENT_PREVIEW = {
  id: '7000000000000000099',
  author: 'parent-author',
  text: 'parent body',
  isDeleted: false,
}

const fixtureCommentReply = () =>
  fixtureComment({
    id: '7000000000000000103',
    parentCommentId: PARENT_PREVIEW.id,
    rootCommentId: PARENT_PREVIEW.id,
    parent: PARENT_PREVIEW,
  })

const commentServiceProvider = {
  provide: CommentService,
  useValue: {
    async getComments({ page = 1, size = 10 } = {}) {
      return {
        data: [
          fixtureComment(),
          fixtureCommentForNote(),
          fixtureCommentOrphan(),
          fixtureCommentReply(),
        ],
        pagination: {
          total: 4,
          currentPage: page,
          totalPage: 1,
          size,
          hasNextPage: false,
          hasPrevPage: false,
        },
      }
    },
    async fillAndReplaceAvatarUrl(rows: any[]) {
      return rows
    },
    async findByIdWithRelations(id: string) {
      // The reply path of `comment-detail.tsx` requires `parent` to be a
      // populated preview; root comments serve `parent: null`.
      if (id === PARENT_PREVIEW.id) return fixtureComment({ id })
      return fixtureCommentReply()
    },
  },
}

const lifecycleProvider = {
  provide: CommentLifecycleService,
  useValue: {
    afterCreateComment() {},
    afterReplyComment() {},
  },
}

const configsProvider = {
  provide: ConfigsService,
  useValue: {
    async get() {
      return { commentShouldAudit: false }
    },
  },
}

const readerServiceProvider = {
  provide: ReaderService,
  useValue: {
    async findReaderInIds() {
      return []
    },
  },
}

const entitlementServiceProvider = {
  provide: EntitlementService,
  useValue: {
    async getActiveMemberIds() {
      return new Set<string>()
    },
  },
}

// `pin: boolean` is the new PG-shape replacement for the legacy `pin: Date`
// field. The legacy-key guard must allow it.
const ALLOWED_LEGACY_KEYS = ['pin']

const COMMENT_LIST_REQUIRED_KEYS = [
  'id',
  'author',
  'text',
  'avatar',
  'state',
  'ref_type',
  'is_whispers',
  'is_deleted',
  'parent_comment_id',
  'root_comment_id',
  'reply_count',
  'latest_reply_at',
  'created_at',
]

// `mail` is intentionally excluded from the detail contract: the
// `CommentFilterEmailInterceptor` strips it for non-authenticated requests
// and the test harness does not wire up the full RolesGuard chain (admin in
// production receives `mail` because their JWT triggers the auth bypass).
// Admin reads `comment.mail` defensively with `&&` (`comment-detail.tsx`).
const COMMENT_DETAIL_REQUIRED_KEYS = [
  ...COMMENT_LIST_REQUIRED_KEYS,
  'url',
  'ip',
  'agent',
  'edited_at',
]

describe('CommentController admin contract (e2e)', () => {
  const proxy = createE2EApp({
    controllers: [CommentController],
    providers: [
      commentServiceProvider,
      lifecycleProvider,
      configsProvider,
      readerServiceProvider,
      entitlementServiceProvider,
      ...eventEmitterProvider,
    ],
  })

  test('GET /comments (admin list) — required field-presence', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/comments`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    assertNoLegacyKeys(body, { allowed: ALLOWED_LEGACY_KEYS })
    assertLowercaseRefType(body)
    assertHasKeys(body.data[0], COMMENT_LIST_REQUIRED_KEYS)
  })

  test('GET /comments/:id (admin detail) — required field-presence', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/comments/7000000000000000100`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertNoLegacyKeys(body, { allowed: ALLOWED_LEGACY_KEYS })
    assertLowercaseRefType(body)
    assertHasKeys(body.data, COMMENT_DETAIL_REQUIRED_KEYS)
  })

  test('GET /comments (admin list) — ref hydrated for post/note rows', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/comments`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    // post-ref: comment-detail.tsx reads ref.title + ref.slug + ref.category.slug.
    assertHasKeysDeep(body.data[0], [
      'ref.id',
      'ref.title',
      'ref.slug',
      'ref.category.slug',
    ])
    // note-ref: comment-detail.tsx reads ref.nid for /notes/:nid url.
    assertHasKeysDeep(body.data[1], ['ref.id', 'ref.title', 'ref.nid'])
    // orphan: server emits explicit null instead of crashing or omitting.
    expect(body.data[2].ref).toBeNull()
  })

  test('GET /comments (admin list) — parent preview hydrated for replies', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/comments`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    // Root comments expose an explicit `null` parent so the dashboard does
    // not have to distinguish between "no parent" and "key missing".
    expect(body.data[0].parent).toBeNull()
    // Replies must carry author/text/is_deleted so the detail header can
    // render `回复 @{parent.author}` plus the parent body preview.
    assertHasKeysDeep(body.data[3], [
      'parent.id',
      'parent.author',
      'parent.text',
      'parent.is_deleted',
    ])
    expect(body.data[3].parent.author).toBe('parent-author')
  })

  test('GET /comments/:id — parent preview is slim (no PII leak)', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/comments/7000000000000000103`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertHasKeysDeep(body.data, [
      'parent.id',
      'parent.author',
      'parent.text',
      'parent.is_deleted',
    ])
    // The parent surface is slimmed to a four-key preview to avoid leaking
    // ip/agent/mail/etc. on the public detail endpoint.
    expect(Object.keys(body.data.parent).sort()).toEqual([
      'author',
      'id',
      'is_deleted',
      'text',
    ])
  })
})
