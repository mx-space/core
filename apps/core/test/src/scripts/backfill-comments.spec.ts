import {
  createPgTestDatabase,
  type PgTestDatabase,
} from 'test/helper/pg-verify-url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { SnowflakeGenerator } from '~/shared/id/snowflake.service'

import { runBackfill as runBackfillCountry } from '../../../scripts/backfill-country'
import { runBackfill as runBackfillOwnerReply } from '../../../scripts/backfill-owner-reply'

interface SeedCommentInput {
  id: string
  parentCommentId?: string | null
  rootCommentId?: string | null
  mail?: string | null
  readerId?: string | null
  ip?: string | null
  countryCode?: string | null
  isOwnerReply?: boolean
}

const silentLogger = { log: () => {}, warn: () => {} }

describe('comments backfill scripts', () => {
  let context: PgTestDatabase
  const generator = new SnowflakeGenerator({ workerId: 23 })

  const seedComment = async (input: SeedCommentInput) => {
    await context.pool.query(
      `insert into comments
         (id, ref_type, ref_id, text, parent_comment_id, root_comment_id,
          mail, reader_id, ip, country_code, is_owner_reply)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        input.id,
        'post',
        '7000000000000000010',
        'body',
        input.parentCommentId ?? null,
        input.rootCommentId ?? null,
        input.mail ?? null,
        input.readerId ?? null,
        input.ip ?? null,
        input.countryCode ?? null,
        input.isOwnerReply ?? false,
      ],
    )
  }

  const clearComments = async () => {
    await context.pool.query('truncate table comments cascade')
  }

  beforeAll(async () => {
    context = await createPgTestDatabase('mx_backfill_comments')

    // Seed an owner reader + profile.
    const ownerReaderId = 'owner-reader-1'
    await context.pool.query(
      `insert into readers (id, email, role) values ($1, $2, $3)`,
      [ownerReaderId, 'owner@example.com', 'owner'],
    )
    await context.pool.query(
      `insert into owner_profiles (id, reader_id, mail) values ($1, $2, $3)`,
      ['owner-profile-1', ownerReaderId, 'Owner-Alt@example.com'],
    )
  }, 60_000)

  afterAll(async () => {
    if (context) await context.close()
  })

  describe('backfill-owner-reply', () => {
    it('flags only owner-authored replies, preserves non-owner rows, and is idempotent', async () => {
      await clearComments()

      const rootGuest = generator.nextId()
      const rootOwner = generator.nextId()
      const replyByReaderId = generator.nextId()
      const replyByEmail = generator.nextId()
      const replyByProfileMail = generator.nextId()
      const replyByOtherMail = generator.nextId()
      const replyAlreadyFlagged = generator.nextId()

      // Root comments — must NEVER be flipped, even when mail matches owner.
      await seedComment({ id: rootGuest, mail: 'guest@example.com' })
      await seedComment({ id: rootOwner, mail: 'owner@example.com' })

      // Replies attributable to the owner via three distinct paths.
      await seedComment({
        id: replyByReaderId,
        parentCommentId: rootGuest,
        rootCommentId: rootGuest,
        readerId: 'owner-reader-1',
        mail: 'unrelated@example.com',
      })
      await seedComment({
        id: replyByEmail,
        parentCommentId: rootGuest,
        rootCommentId: rootGuest,
        mail: 'OWNER@example.com',
      })
      await seedComment({
        id: replyByProfileMail,
        parentCommentId: rootGuest,
        rootCommentId: rootGuest,
        mail: 'owner-alt@example.com',
      })

      // Reply by a non-owner — must NOT be flipped.
      await seedComment({
        id: replyByOtherMail,
        parentCommentId: rootGuest,
        rootCommentId: rootGuest,
        mail: 'someone@example.com',
      })

      // Already-flagged reply — must be a no-op and excluded from the
      // candidate set so the updated count is exact.
      await seedComment({
        id: replyAlreadyFlagged,
        parentCommentId: rootGuest,
        rootCommentId: rootGuest,
        mail: 'owner@example.com',
        isOwnerReply: true,
      })

      const first = await runBackfillOwnerReply({
        pool: context.pool,
        mode: 'apply',
        logger: silentLogger,
      })
      expect(first.updated).toBe(3)
      expect(first.scanned).toBe(3)

      const { rows: after } = await context.pool.query<{
        id: string
        is_owner_reply: boolean
      }>('select id, is_owner_reply from comments order by id::bigint')
      const byId = new Map(after.map((r) => [r.id, r.is_owner_reply]))
      expect(byId.get(rootGuest)).toBe(false)
      expect(byId.get(rootOwner)).toBe(false)
      expect(byId.get(replyByReaderId)).toBe(true)
      expect(byId.get(replyByEmail)).toBe(true)
      expect(byId.get(replyByProfileMail)).toBe(true)
      expect(byId.get(replyByOtherMail)).toBe(false)
      expect(byId.get(replyAlreadyFlagged)).toBe(true)

      // Re-run — idempotent: candidate set is empty, nothing updated.
      const second = await runBackfillOwnerReply({
        pool: context.pool,
        mode: 'apply',
        logger: silentLogger,
      })
      expect(second.updated).toBe(0)
      expect(second.scanned).toBe(0)
    })

    it('dry-run reports counts without writing', async () => {
      await clearComments()
      const root = generator.nextId()
      const reply = generator.nextId()
      await seedComment({ id: root, mail: 'guest@example.com' })
      await seedComment({
        id: reply,
        parentCommentId: root,
        rootCommentId: root,
        mail: 'owner@example.com',
      })

      const result = await runBackfillOwnerReply({
        pool: context.pool,
        mode: 'dry-run',
        logger: silentLogger,
      })
      expect(result.scanned).toBe(1)
      expect(result.updated).toBe(0)

      const { rows } = await context.pool.query<{ is_owner_reply: boolean }>(
        'select is_owner_reply from comments where id = $1',
        [reply],
      )
      expect(rows[0].is_owner_reply).toBe(false)
    })

    it('iterates across multiple batches without missing rows', async () => {
      await clearComments()
      const root = generator.nextId()
      await seedComment({ id: root, mail: 'guest@example.com' })

      const replyIds: string[] = []
      for (let i = 0; i < 5; i++) {
        const id = generator.nextId()
        replyIds.push(id)
        await seedComment({
          id,
          parentCommentId: root,
          rootCommentId: root,
          mail: 'owner@example.com',
        })
      }

      const result = await runBackfillOwnerReply({
        pool: context.pool,
        mode: 'apply',
        batchSize: 2,
        logger: silentLogger,
      })
      expect(result.scanned).toBe(5)
      expect(result.updated).toBe(5)

      const { rows } = await context.pool.query<{ c: string }>(
        `select count(*)::text as c from comments where is_owner_reply = true`,
      )
      expect(Number(rows[0].c)).toBe(5)
    })
  })

  describe('backfill-country', () => {
    it('populates country codes from ip and is idempotent', async () => {
      await clearComments()

      const withIp1 = generator.nextId()
      const withIp2 = generator.nextId()
      const withIpAlreadySet = generator.nextId()
      const withoutIp = generator.nextId()
      const withUnresolvableIp = generator.nextId()

      await seedComment({ id: withIp1, ip: '1.1.1.1' })
      await seedComment({ id: withIp2, ip: '8.8.8.8' })
      await seedComment({
        id: withIpAlreadySet,
        ip: '1.1.1.1',
        countryCode: 'US',
      })
      await seedComment({ id: withoutIp })
      await seedComment({ id: withUnresolvableIp, ip: '10.0.0.1' })

      const calls: string[] = []
      const lookup = async (ip: string) => {
        calls.push(ip)
        if (ip === '1.1.1.1') return 'AU'
        if (ip === '8.8.8.8') return 'US'
        return null
      }

      const first = await runBackfillCountry({
        pool: context.pool,
        mode: 'apply',
        lookup,
        logger: silentLogger,
      })
      expect(first.scanned).toBe(3)
      expect(first.resolved).toBe(2)
      expect(first.updated).toBe(2)
      expect(first.skipped).toBe(1)

      const { rows } = await context.pool.query<{
        id: string
        country_code: string | null
      }>('select id, country_code from comments order by id::bigint')
      const byId = new Map(rows.map((r) => [r.id, r.country_code]))
      expect(byId.get(withIp1)).toBe('AU')
      expect(byId.get(withIp2)).toBe('US')
      // Pre-populated value must be preserved exactly.
      expect(byId.get(withIpAlreadySet)).toBe('US')
      expect(byId.get(withoutIp)).toBeNull()
      expect(byId.get(withUnresolvableIp)).toBeNull()

      // Dedupes within a batch — 1.1.1.1 is shared across two rows but the
      // lookup is invoked once for that IP per batch.
      expect(calls.sort()).toEqual(['1.1.1.1', '10.0.0.1', '8.8.8.8'])

      // Re-run — already-populated rows fall out; only the unresolvable one
      // remains.
      calls.length = 0
      const second = await runBackfillCountry({
        pool: context.pool,
        mode: 'apply',
        lookup,
        logger: silentLogger,
      })
      expect(second.scanned).toBe(1)
      expect(second.resolved).toBe(0)
      expect(second.updated).toBe(0)
      expect(second.skipped).toBe(1)
      expect(calls).toEqual(['10.0.0.1'])
    })

    it('dry-run reports what would change without writing', async () => {
      await clearComments()
      const row = generator.nextId()
      await seedComment({ id: row, ip: '1.2.3.4' })

      const result = await runBackfillCountry({
        pool: context.pool,
        mode: 'dry-run',
        lookup: async () => 'JP',
        logger: silentLogger,
      })
      expect(result.updated).toBe(1)
      expect(result.skipped).toBe(0)

      const { rows } = await context.pool.query<{
        country_code: string | null
      }>('select country_code from comments where id = $1', [row])
      expect(rows[0].country_code).toBeNull()
    })
  })
})
