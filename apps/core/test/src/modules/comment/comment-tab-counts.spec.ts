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

describe('CommentRepository.getTabCounts', () => {
  let context: PgTestDatabase
  let pool: Pool
  let repository: CommentRepository
  let snowflake: SnowflakeService

  beforeAll(async () => {
    context = await createPgTestDatabase('mx_comment_tab_counts')
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

  const insertComment = async (
    overrides: Partial<typeof comments.$inferInsert> = {},
  ) => {
    const refId = (overrides.refId as string | undefined) ?? snowflake.nextId()
    const id = (overrides.id as string | undefined) ?? snowflake.nextId()
    await context.db.insert(comments).values({
      id,
      refType: CollectionRefTypes.Post,
      refId,
      text: 'hi',
      state: CommentState.Unread,
      isDeleted: false,
      isWhispers: false,
      isOwnerReply: false,
      ...overrides,
    })
    return id
  }

  it('returns zero across the board for an empty table', async () => {
    await expect(repository.getTabCounts()).resolves.toEqual({
      unread: 0,
      read: 0,
      junk: 0,
      whispers: 0,
      awaiting: 0,
      all: 0,
    })
  })

  it('computes all six counts in a single round trip', async () => {
    const refId = snowflake.nextId()
    await insertComment({ refId, state: CommentState.Unread })
    await insertComment({ refId, state: CommentState.Read })
    await insertComment({ refId, state: CommentState.Junk })
    await insertComment({ refId, state: CommentState.Read, isWhispers: true })
    await insertComment({
      refId,
      state: CommentState.Read,
      isDeleted: true,
    })

    const counts = await repository.getTabCounts()
    expect(counts.unread).toBe(1)
    // 1 read + 1 whispers (whispers is also Read) — both non-deleted
    expect(counts.read).toBe(2)
    expect(counts.junk).toBe(1)
    expect(counts.whispers).toBe(1)
    // Awaiting = state != Junk && !is_deleted && no later owner-reply.
    // 3 rows qualify: unread + read + whispers. Deleted excluded; junk excluded.
    expect(counts.awaiting).toBe(3)
    // All non-deleted
    expect(counts.all).toBe(4)
  })

  it('excludes rows out of the refType/refId scope', async () => {
    const refA = snowflake.nextId()
    const refB = snowflake.nextId()
    await insertComment({ refId: refA, state: CommentState.Unread })
    await insertComment({ refId: refA, state: CommentState.Read })
    await insertComment({
      refId: refB,
      refType: CollectionRefTypes.Note,
      state: CommentState.Read,
    })

    const scoped = await repository.getTabCounts({
      refType: CollectionRefTypes.Post,
      refId: refA,
    })
    expect(scoped.unread).toBe(1)
    expect(scoped.read).toBe(1)
    expect(scoped.all).toBe(2)

    const typeOnly = await repository.getTabCounts({
      refType: CollectionRefTypes.Note,
    })
    expect(typeOnly.read).toBe(1)
    expect(typeOnly.all).toBe(1)
  })

  it('keeps junk visible even when soft-deleted (junk is the terminal tab)', async () => {
    await insertComment({ state: CommentState.Junk })
    await insertComment({ state: CommentState.Junk, isDeleted: true })

    const counts = await repository.getTabCounts()
    expect(counts.junk).toBe(2)
    expect(counts.all).toBe(1)
  })
})
