import { describe, expect, test } from 'vitest'

import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { CommentController } from '~/modules/comment/comment.controller'
import { CommentLifecycleService } from '~/modules/comment/comment.lifecycle.service'
import { CommentService } from '~/modules/comment/comment.service'
import { ConfigsService } from '~/modules/configs/configs.service'
import { ReaderService } from '~/modules/reader/reader.service'

import {
  assertHasKeysDeep,
  assertLowercaseRefType,
  assertNoLegacyKeys,
  assertPgTimestamps,
} from '../../helper/api-shape'
import { createE2EApp } from '../../helper/create-e2e-app'
import { authPassHeader } from '../../mock/guard/auth.guard'
import { eventEmitterProvider } from '../../mock/processors/event.mock'

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
  // `pin: boolean` is the new PG-shape field for comments — must be ALLOWED.
  pin: false,
  isWhispers: false,
  refId: '7000000000000000010',
  refType: 'post',
  parentId: null,
  childrenIds: [],
  readerId: null,
  ip: null,
  createdAt: new Date('2024-10-01T00:00:00.000Z'),
  modifiedAt: null,
  ref: POST_REF,
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

const commentServiceProvider = {
  provide: CommentService,
  useValue: {
    async getComments({ page = 1, size = 10 } = {}) {
      return {
        data: [
          fixtureComment(),
          fixtureCommentForNote(),
          fixtureCommentOrphan(),
        ],
        pagination: {
          total: 3,
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
        data: [fixtureComment({ parentId: '7000000000000000100' })],
        pagination: {
          total: 1,
          currentPage: 1,
          totalPage: 1,
          size: 10,
          hasNextPage: false,
          hasPrevPage: false,
        },
      }
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

describe('CommentController contract (e2e)', () => {
  const proxy = createE2EApp({
    controllers: [CommentController],
    providers: [
      commentServiceProvider,
      lifecycleProvider,
      configsProvider,
      readerServiceProvider,
      ...eventEmitterProvider,
    ],
  })

  // `pin` is the new boolean-typed field on comments (replaces legacy
  // `pin: Date`). Tests must explicitly allow it.
  const allowedCommentKeys = ['pin']

  test('GET /comments — admin list, no legacy keys, lowercase ref_type', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/comments`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    assertNoLegacyKeys(body, { allowed: allowedCommentKeys })
    assertPgTimestamps(body.data[0])
    assertLowercaseRefType(body)
  })

  test('GET /comments/:id — detail, no legacy keys', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/comments/7000000000000000100`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertNoLegacyKeys(body, { allowed: allowedCommentKeys })
    assertPgTimestamps(body)
    assertLowercaseRefType(body)
  })

  test('GET /comments/ref/:id — public per-article thread, no legacy keys', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/comments/ref/7000000000000000010`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    assertNoLegacyKeys(body, { allowed: allowedCommentKeys })
    assertPgTimestamps(body.data[0])
    assertLowercaseRefType(body)
  })

  test('GET /comments/thread/:rootCommentId — child replies, no legacy keys', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/comments/thread/7000000000000000100`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    assertNoLegacyKeys(body, { allowed: allowedCommentKeys })
    assertPgTimestamps(body.data[0])
    assertLowercaseRefType(body)
  })

  test('GET /comments — admin list hydrates ref per row (post/note/orphan)', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/comments`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    // post-ref row exposes id/title/slug + nested category.slug.
    assertHasKeysDeep(body.data[0], [
      'ref.id',
      'ref.title',
      'ref.slug',
      'ref.category.slug',
    ])
    // note-ref row exposes id/title/nid (no category).
    assertHasKeysDeep(body.data[1], ['ref.id', 'ref.title', 'ref.nid'])
    // orphan ref serialized as null so dashboard renders a degraded label.
    expect(body.data[2].ref).toBeNull()
  })

  test('GET /comments/:id — detail hydrates ref', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/comments/7000000000000000100`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertHasKeysDeep(body, ['ref.id', 'ref.title', 'ref.slug'])
  })
})
