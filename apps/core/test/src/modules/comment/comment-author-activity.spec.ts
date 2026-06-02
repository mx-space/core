import type { Pool } from 'pg'
import {
  createPgTestDatabase,
  type PgTestDatabase,
} from 'test/helper/pg-verify-url'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { AppException } from '~/common/errors/exception.types'
import { CollectionRefTypes } from '~/constants/db.constant'
import { comments } from '~/database/schema'
import { CommentState } from '~/modules/comment/comment.enum'
import { CommentRepository } from '~/modules/comment/comment.repository'
import { CommentService } from '~/modules/comment/comment.service'
import { SnowflakeService } from '~/shared/id/snowflake.service'

const buildService = (repository: CommentRepository) => {
  const redisStore = new Map<string, string>()
  const redisClient = {
    get: async (key: string) => redisStore.get(key) ?? null,
    set: async (key: string, value: string) => {
      redisStore.set(key, value)
      return 'OK'
    },
    del: async (key: string) => {
      redisStore.delete(key)
      return 1
    },
    keys: async (pattern: string) => {
      const prefix = pattern.replace(/\*$/, '')
      return [...redisStore.keys()].filter((key) => key.startsWith(prefix))
    },
  }
  const redisService = { getClient: () => redisClient } as any
  return new CommentService(
    repository,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    { lookupCountryCode: async () => null } as any,
    redisService,
  )
}

describe('CommentService.getAuthorActivity', () => {
  let context: PgTestDatabase
  let pool: Pool
  let repository: CommentRepository
  let service: CommentService
  let snowflake: SnowflakeService

  beforeAll(async () => {
    context = await createPgTestDatabase('mx_comment_author_activity')
    pool = context.pool
    snowflake = new SnowflakeService()
    repository = new CommentRepository(context.db as any, snowflake)
    service = buildService(repository)
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
      state: CommentState.Read,
      isDeleted: false,
      isWhispers: false,
      isOwnerReply: false,
      ...overrides,
    })
    return id
  }

  it('throws VALIDATION_FAILED when neither mail nor ip is supplied', async () => {
    await expect(service.getAuthorActivity({})).rejects.toBeInstanceOf(
      AppException,
    )
  })

  it('returns trusted when no junk in 30d and totalCount >= 3', async () => {
    const mail = 'alice@example.com'
    for (let i = 0; i < 4; i++) {
      await insert({ mail, state: CommentState.Read })
    }

    const result = await service.getAuthorActivity({ mail })
    expect(result.totalCount).toBe(4)
    expect(result.threatLevel).toBe('trusted')
    expect(result.items).toHaveLength(4)
  })

  it('returns risk when the author has ever been junk-flagged', async () => {
    const mail = 'spam@example.com'
    await insert({ mail, state: CommentState.Junk })
    await insert({ mail, state: CommentState.Read })
    await insert({ mail, state: CommentState.Read })

    const result = await service.getAuthorActivity({ mail })
    expect(result.threatLevel).toBe('risk')
    expect(result.threatReason).toMatch(/junk/i)
  })

  it('returns risk when same /24 IP block has >= 3 junk in the last 7 days', async () => {
    const ip = '203.0.113.5'
    // The author's own visible comments do NOT include any junk — risk
    // comes purely from the cohort signal on the same /24 block.
    await insert({ ip, state: CommentState.Read })

    // Three junk comments from the same /24 (within last 7d).
    await insert({
      ip: '203.0.113.10',
      state: CommentState.Junk,
      createdAt: new Date(),
    })
    await insert({
      ip: '203.0.113.20',
      state: CommentState.Junk,
      createdAt: new Date(),
    })
    await insert({
      ip: '203.0.113.30',
      state: CommentState.Junk,
      createdAt: new Date(),
    })

    const result = await service.getAuthorActivity({ ip })
    expect(result.threatLevel).toBe('risk')
    expect(result.threatReason).toMatch(/\/24/)
  })

  it('returns neutral when the author has fewer than 3 historical comments and no junk', async () => {
    const mail = 'newbie@example.com'
    await insert({ mail, state: CommentState.Read })

    const result = await service.getAuthorActivity({ mail })
    expect(result.threatLevel).toBe('neutral')
    expect(result.totalCount).toBe(1)
  })
})
