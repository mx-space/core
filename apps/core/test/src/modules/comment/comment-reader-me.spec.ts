import type { Pool } from 'pg'
import {
  createPgTestDatabase,
  type PgTestDatabase,
} from 'test/helper/pg-verify-url'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { CollectionRefTypes } from '~/constants/db.constant'
import { comments, readers } from '~/database/schema'
import { CommentState } from '~/modules/comment/comment.enum'
import { CommentRepository } from '~/modules/comment/comment.repository'
import { CommentService } from '~/modules/comment/comment.service'
import { SnowflakeService } from '~/shared/id/snowflake.service'

const buildService = (repository: CommentRepository) =>
  new CommentService(
    repository,
    {} as any,
    {} as any,
    { broadcast: async () => undefined } as any,
    {} as any,
    {} as any,
    { lookupCountryCode: async () => null } as any,
    { getClient: () => ({}) } as any,
  )

describe('CommentService.projectReaderComment', () => {
  it('projects the joined ref into the mobile list contract', () => {
    const service = buildService({} as CommentRepository)
    expect(
      service.projectReaderComment({
        createdAt: new Date('2026-08-15T00:00:00.000Z'),
        id: '1',
        ref: {
          category: { name: 'Coding', slug: 'coding' },
          id: '2',
          slug: 'hello',
          title: 'Hello',
          type: CollectionRefTypes.Post,
        },
        refId: '2',
        refType: CollectionRefTypes.Post,
        text: 'nice post',
      } as any),
    ).toEqual({
      createdAt: new Date('2026-08-15T00:00:00.000Z'),
      id: '1',
      refId: '2',
      refType: CollectionRefTypes.Post,
      source: {
        categorySlug: 'coding',
        nid: null,
        slug: 'hello',
      },
      sourceTitle: 'Hello',
      text: 'nice post',
    })
  })

  it('nulls source when the joined article is gone', () => {
    const service = buildService({} as CommentRepository)
    expect(
      service.projectReaderComment({
        createdAt: new Date('2026-08-15T00:00:00.000Z'),
        id: '1',
        ref: null,
        refId: '2',
        refType: CollectionRefTypes.Note,
        text: 'orphan',
      } as any),
    ).toMatchObject({ source: null, sourceTitle: null })
  })
})

describe.skipIf(!process.env.PG_VERIFY_URL)(
  'CommentRepository reader comments',
  () => {
    let context: PgTestDatabase
    let pool: Pool
    let repository: CommentRepository
    let snowflake: SnowflakeService
    let readerId: string
    let otherReaderId: string

    beforeAll(async () => {
      context = await createPgTestDatabase('mx_comment_reader_me')
      pool = context.pool
      snowflake = new SnowflakeService()
      repository = new CommentRepository(context.db as any, snowflake)
      readerId = snowflake.nextId()
      otherReaderId = snowflake.nextId()
      await context.db.insert(readers).values([
        { id: readerId, name: 'Me' },
        { id: otherReaderId, name: 'Other' },
      ])
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
        isDeleted: false,
        isOwnerReply: false,
        isWhispers: false,
        refId: snowflake.nextId(),
        refType: CollectionRefTypes.Post,
        state: CommentState.Read,
        text: 'hi',
        ...overrides,
      })
      return id
    }

    it('lists only the reader’s active comments', async () => {
      const keep = await insert({ readerId, text: 'keep' })
      await insert({ readerId, isDeleted: true, text: 'deleted' })
      await insert({ readerId, state: CommentState.Junk, text: 'junk' })
      await insert({ readerId: otherReaderId, text: 'other' })
      await insert({ readerId: null, text: 'guest' })

      const result = await repository.paginatedFind(
        { excludeJunk: true, isDeleted: false, readerId },
        1,
        20,
      )
      expect(result.data.map((row) => row.text)).toEqual(['keep'])
      expect(result.data[0]?.id).toBe(keep)
      expect(result.pagination.total).toBe(1)
    })
  },
)
