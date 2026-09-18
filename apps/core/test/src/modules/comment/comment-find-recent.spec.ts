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

describe('CommentRepository.findRecent public visibility', () => {
  let context: PgTestDatabase
  let pool: Pool
  let repository: CommentRepository
  let snowflake: SnowflakeService

  beforeAll(async () => {
    context = await createPgTestDatabase('mx_comment_find_recent')
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

  it('omits junk comments from the public recent list', async () => {
    await insert({
      text: 'spam',
      state: CommentState.Junk,
      createdAt: new Date('2026-09-18T12:00:00.000Z'),
    })
    await insert({
      text: 'hello',
      state: CommentState.Read,
      createdAt: new Date('2026-09-18T11:00:00.000Z'),
    })

    const rows = await repository.findRecent(3, {
      publicFilter: {
        isAuthenticated: false,
        commentShouldAudit: false,
      },
    })

    expect(rows.map((row) => row.text)).toEqual(['hello'])
  })

  it('omits whispers and deleted comments from the public recent list', async () => {
    await insert({
      text: 'whisper',
      state: CommentState.Read,
      isWhispers: true,
      createdAt: new Date('2026-09-18T12:00:00.000Z'),
    })
    await insert({
      text: 'gone',
      state: CommentState.Read,
      isDeleted: true,
      createdAt: new Date('2026-09-18T11:30:00.000Z'),
    })
    await insert({
      text: 'visible',
      state: CommentState.Unread,
      createdAt: new Date('2026-09-18T11:00:00.000Z'),
    })

    const rows = await repository.findRecent(3, {
      publicFilter: {
        isAuthenticated: false,
        commentShouldAudit: false,
      },
    })

    expect(rows.map((row) => row.text)).toEqual(['visible'])
  })

  it('returns only audited comments when commentShouldAudit is on', async () => {
    await insert({
      text: 'pending',
      state: CommentState.Unread,
      createdAt: new Date('2026-09-18T12:00:00.000Z'),
    })
    await insert({
      text: 'approved',
      state: CommentState.Read,
      createdAt: new Date('2026-09-18T11:00:00.000Z'),
    })

    const rows = await repository.findRecent(3, {
      publicFilter: {
        isAuthenticated: false,
        commentShouldAudit: true,
      },
    })

    expect(rows.map((row) => row.text)).toEqual(['approved'])
  })
})
