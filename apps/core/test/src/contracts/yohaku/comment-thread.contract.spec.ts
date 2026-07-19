/**
 * Yohaku consumer contract: comment thread.
 *
 * Drives `GET /comments/ref/:id` (Yohaku reads via apiClient hook
 * `apiClient.proxy.comments.ref(id)`) consumed by:
 *   - `Comment.tsx`            — `comment.id/text/author/avatar/readerId/
 *                                 created/replyCount/parentCommentId/children`
 *   - `CommentBlockThread.tsx` — `comment.created/text`
 *   - `CommentPinButton.tsx`   — `comment.pin/parentCommentId`
 *   - `thread.ts`              — sort by `comment.created`
 *
 * Server emits `created_at` (Yohaku stale reads `created` — list separately).
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
  assertLowercaseRefType,
  assertNoLegacyKeys,
  assertPgTimestamps,
} from '../../../helper/api-shape'
import { createE2EApp } from '../../../helper/create-e2e-app'
import { eventEmitterProvider } from '../../../mock/processors/event.mock'

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
  refId: '7000000000000000010',
  refType: 'post',
  parentCommentId: null,
  rootCommentId: null,
  children: [],
  replyCount: 0,
  readerId: null,
  ip: null,
  agent: null,
  location: null,
  createdAt: new Date('2024-10-01T00:00:00.000Z'),
  modifiedAt: null,
  ...overrides,
})

const commentServiceProvider = {
  provide: CommentService,
  useValue: {
    async fillAndReplaceAvatarUrl(rows: any[]) {
      return rows
    },
    async findByIdWithRelations(id: string) {
      return fixtureComment({ id })
    },
    async getCommentsByRefId(_id: string, { page = 1, size = 10 } = {}) {
      return {
        data: [fixtureComment()],
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
    collectThreadReaderIds() {
      return []
    },
    async getThreadReplies() {
      return {
        replies: [fixtureComment({ parentCommentId: '7000000000000000100' })],
        remaining: 0,
        done: true,
        nextCursor: null,
      }
    },
  },
}

const lifecycleProvider = {
  provide: CommentLifecycleService,
  useValue: { afterCreateComment() {}, afterReplyComment() {} },
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

const getResponseData = (body: any) =>
  Array.isArray(body.data) ? body.data : body.data?.data

describe('Yohaku contract — comment thread (e2e)', () => {
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

  const allowedCommentKeys = ['pin']

  test('GET /comments/ref/:id — exposes every field Yohaku Comment.tsx reads', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/comments/ref/7000000000000000010`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()

    assertNoLegacyKeys(body, { allowed: allowedCommentKeys })
    assertLowercaseRefType(body)
    const data = getResponseData(body)
    expect(Array.isArray(data)).toBe(true)
    assertPgTimestamps(data[0])

    assertHasKeys(data[0], [
      'id',
      'author',
      'text',
      'avatar',
      'state',
      'pin',
      'parent_comment_id',
      'reply_count',
      'reader_id',
      'ref_id',
      'ref_type',
      'created_at',
    ])
  })

  test('GET /comments/:id — single-comment detail keys', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/comments/7000000000000000100`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()

    assertNoLegacyKeys(body, { allowed: allowedCommentKeys })
    assertHasKeys(body.data, ['id', 'author', 'text', 'created_at', 'state'])
  })
})
