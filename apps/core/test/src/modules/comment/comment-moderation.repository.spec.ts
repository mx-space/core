import { createHash } from 'node:crypto'

import {
  createPgTestDatabase,
  type PgTestDatabase,
} from 'test/helper/pg-verify-url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { CollectionRefTypes } from '~/constants/db.constant'
import { readers } from '~/database/schema'
import { CommentRepository } from '~/modules/comment/comment.repository'
import { SnowflakeService } from '~/shared/id/snowflake.service'

describe('durable comment moderation', () => {
  let context: PgTestDatabase
  let repository: CommentRepository
  const snowflake = new SnowflakeService()
  beforeAll(async () => {
    context = await createPgTestDatabase('mx_comment_moderation')
    repository = new CommentRepository(context.db as any, snowflake)
  }, 60000)
  afterAll(async () => {
    await context?.close()
  })

  it('hides pending roots and replies, recovers them, and preserves unread status after approval', async () => {
    const refId = snowflake.nextId()
    const root = await repository.create({
      refType: CollectionRefTypes.Post,
      refId,
      text: 'root',
      moderationStatus: 'pending',
    })
    const options = {
      page: 1,
      size: 10,
      sort: 'newest' as const,
      isAuthenticated: false,
      commentShouldAudit: false,
    }
    expect(
      (await repository.findRootThreadsByRef(refId, options)).data,
    ).toHaveLength(0)
    expect((await repository.pendingReviews()).map((row) => row.id)).toContain(
      root.id,
    )
    expect(await repository.beginReview(root)).toBe(1)
    const approved = await repository.finishReview(root, 'approved')
    expect(approved?.state).toBe(0)
    expect(
      (await repository.findRootThreadsByRef(refId, options)).data,
    ).toHaveLength(1)
    expect(
      (
        await repository.findRootThreadsByRef(refId, {
          ...options,
          commentShouldAudit: true,
        })
      ).data,
    ).toHaveLength(0)
    const reply = await repository.createReply({
      refType: CollectionRefTypes.Post,
      refId,
      parentCommentId: root.id,
      text: 'reply',
      moderationStatus: 'pending',
    })
    expect((await repository.pendingReviews()).map((row) => row.id)).toContain(
      reply.id,
    )
    expect(
      await repository.findVisibleRepliesForRoot(root.id, options),
    ).toHaveLength(0)
    await repository.finishReview(reply, 'rejected')
    expect((await repository.findById(reply.id))?.state).toBe(2)
  })

  it('keeps approved reader comments public when human approval is required', async () => {
    const refId = snowflake.nextId()
    const readerId = snowflake.nextId()
    await context.db.insert(readers).values({ id: readerId, name: 'Reader' })
    await repository.create({
      refType: CollectionRefTypes.Post,
      refId,
      text: 'reader',
      moderationStatus: 'approved',
      readerId,
    })
    await repository.create({
      refType: CollectionRefTypes.Post,
      refId,
      text: 'guest',
      moderationStatus: 'approved',
    })
    const { data } = await repository.findRootThreadsByRef(refId, {
      page: 1,
      size: 10,
      sort: 'newest',
      isAuthenticated: false,
      commentShouldAudit: true,
    })
    expect(data.map((row) => row.text)).toEqual(['reader'])
  })

  it('cannot overwrite manual decisions or edited text with stale model results', async () => {
    const input = {
      refType: CollectionRefTypes.Post,
      refId: snowflake.nextId(),
      text: 'original',
      moderationStatus: 'pending',
    }
    const edited = await repository.create(input)
    await repository.update(edited.id, { text: 'updated' })
    expect(await repository.finishReview(edited, 'rejected')).toBeNull()
    const manual = await repository.create(input)
    await repository.updateStateBulk([manual.id], 1)
    expect(await repository.finishReview(manual, 'rejected')).toBeNull()
    expect((await repository.findById(manual.id))?.moderationStatus).toBe(
      'approved',
    )
  })

  it('restricts receipts to their comment, expires them, and never returns receipt hashes', async () => {
    const receipt = 'a'.repeat(64)
    const hash = createHash('sha256').update(receipt).digest('hex')
    const row = await repository.create({
      refType: CollectionRefTypes.Post,
      refId: snowflake.nextId(),
      text: 'private',
      isWhispers: true,
      moderationStatus: 'pending',
      moderationReceiptHash: hash,
    })
    expect(await repository.findByReceipt(row.id, hash)).toMatchObject({
      id: row.id,
    })
    expect(row).not.toHaveProperty('moderationReceiptHash')
    expect(await repository.findByReceipt(row.id, 'wrong')).toBeNull()
    await context.pool.query(
      "update comments set created_at = now() - interval '8 days' where id = $1",
      [row.id],
    )
    expect(await repository.findByReceipt(row.id, hash)).toBeNull()
  })
})
