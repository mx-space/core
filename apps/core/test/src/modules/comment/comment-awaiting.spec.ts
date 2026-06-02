import type { Pool } from 'pg'
import {
  createPgTestDatabase,
  type PgTestDatabase,
} from 'test/helper/pg-verify-url'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { CollectionRefTypes } from '~/constants/db.constant'
import { comments } from '~/database/schema'
import { CommentState } from '~/modules/comment/comment.enum'
import { CommentRepository } from '~/modules/comment/comment.repository'
import { SnowflakeService } from '~/shared/id/snowflake.service'

/**
 * Spec §6.1 awaiting predicate:
 *   state != Junk AND NOT is_deleted AND NOT EXISTS (
 *     owner_reply with same root_comment_id and created_at > the row's
 *   )
 *
 * Three predicate states are covered:
 *   1. Root with no owner reply at all                 → awaiting
 *   2. Root with an owner reply older than the row     → awaiting (none later)
 *   3. Root with an owner reply NEWER than the row     → not awaiting
 */
describe('CommentRepository awaiting predicate', () => {
  let context: PgTestDatabase
  let pool: Pool
  let repository: CommentRepository
  let snowflake: SnowflakeService

  beforeAll(async () => {
    context = await createPgTestDatabase('mx_comment_awaiting')
    pool = context.pool
    snowflake = new SnowflakeService()
    repository = new CommentRepository(context.db as any, snowflake)
  }, 60_000)

  beforeEach(async () => {
    await pool.query('truncate table comments restart identity cascade')
  })

  afterAll(async () => {
    if (context) await context.close()
  })

  const insert = async (overrides: Partial<typeof comments.$inferInsert>) => {
    const id = (overrides.id as string | undefined) ?? snowflake.nextId()
    await context.db.insert(comments).values({
      id,
      refType: CollectionRefTypes.Post,
      refId: snowflake.nextId(),
      text: 'hi',
      state: CommentState.Unread,
      isDeleted: false,
      isWhispers: false,
      isOwnerReply: false,
      ...overrides,
    })
    return id
  }

  it('counts a root with no owner reply as awaiting', async () => {
    await insert({ state: CommentState.Unread })

    const counts = await repository.getTabCounts()
    expect(counts.awaiting).toBe(1)
  })

  it('counts a root whose owner reply is older than itself as awaiting', async () => {
    // root R created at t=100; owner reply at t=50 (older). The predicate
    // requires NO owner_reply with created_at > root.created_at — there is
    // none, so R is awaiting.
    const rootId = await insert({
      state: CommentState.Unread,
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
    })
    await insert({
      rootCommentId: rootId,
      parentCommentId: rootId,
      isOwnerReply: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    })

    const counts = await repository.getTabCounts()
    expect(counts.awaiting).toBe(2)
  })

  it('does NOT count a root whose owner reply is newer as awaiting', async () => {
    const rootId = await insert({
      state: CommentState.Unread,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    })
    await insert({
      rootCommentId: rootId,
      parentCommentId: rootId,
      isOwnerReply: true,
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
    })

    const counts = await repository.getTabCounts()
    // The owner reply itself qualifies (no later owner reply, not deleted,
    // not junk) — root does NOT. So awaiting should be 1.
    expect(counts.awaiting).toBe(1)
  })

  it('excludes junk and deleted from awaiting regardless of reply state', async () => {
    await insert({ state: CommentState.Junk })
    await insert({ state: CommentState.Unread, isDeleted: true })

    const counts = await repository.getTabCounts()
    expect(counts.awaiting).toBe(0)
  })
})
