import * as schema from '@mx-space/db-schema/schema'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { createIsolatedPgDatabase } from 'test/helper/pg-testcontainer'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ReaderRepository } from '~/modules/reader/reader.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { SnowflakeService } from '~/shared/id/snowflake.service'

describe('ReaderRepository membership summary + filter (real PG)', () => {
  let pool: Pool
  let database: Awaited<ReturnType<typeof createIsolatedPgDatabase>>
  let db: AppDatabase
  let readerRepository: ReaderRepository
  const snowflake = new SnowflakeService()

  const activeReaderId = snowflake.nextId()
  const onHoldReaderId = snowflake.nextId()
  const cancelledReaderId = snowflake.nextId()
  const expiredStatusReaderId = snowflake.nextId()
  const expiredPeriodReaderId = snowflake.nextId()
  const noMembershipReaderId = snowflake.nextId()

  const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000)

  beforeAll(async () => {
    database = await createIsolatedPgDatabase()
    pool = new Pool({ connectionString: database.getConnectionUri(), max: 4 })
    db = drizzle(pool, { schema }) as unknown as AppDatabase
    readerRepository = new ReaderRepository(db)

    await db.insert(schema.readers).values([
      { id: activeReaderId, name: 'Active Reader', role: 'reader' },
      { id: onHoldReaderId, name: 'On Hold Reader', role: 'reader' },
      { id: cancelledReaderId, name: 'Cancelled Reader', role: 'reader' },
      {
        id: expiredStatusReaderId,
        name: 'Expired Status Reader',
        role: 'reader',
      },
      {
        id: expiredPeriodReaderId,
        name: 'Expired Period Reader',
        role: 'reader',
      },
      {
        id: noMembershipReaderId,
        name: 'No Membership Reader',
        role: 'reader',
      },
    ])

    await db.insert(schema.memberships).values([
      {
        id: snowflake.nextId(),
        readerId: activeReaderId,
        provider: 'dodo',
        plan: 'monthly',
        status: 'active',
        currentPeriodEnd: future,
      },
      {
        id: snowflake.nextId(),
        readerId: onHoldReaderId,
        provider: 'dodo',
        plan: 'monthly',
        status: 'on_hold',
        currentPeriodEnd: future,
      },
      {
        id: snowflake.nextId(),
        readerId: cancelledReaderId,
        provider: 'manual',
        plan: 'yearly',
        status: 'cancelled',
        currentPeriodEnd: future,
      },
      {
        id: snowflake.nextId(),
        readerId: expiredStatusReaderId,
        provider: 'dodo',
        plan: 'monthly',
        status: 'expired',
        currentPeriodEnd: future,
      },
      {
        id: snowflake.nextId(),
        readerId: expiredPeriodReaderId,
        provider: 'dodo',
        plan: 'monthly',
        status: 'active',
        currentPeriodEnd: past,
      },
    ])
  }, 120_000)

  afterAll(async () => {
    await pool?.end()
    await database?.drop()
  })

  it('carries a membership summary for member and non-member rows', async () => {
    const result = await readerRepository.list({ page: 1, size: 100 })
    const byId = new Map(result.data.map((row) => [row.id, row]))

    expect(byId.get(activeReaderId)?.membership).toEqual({
      status: 'active',
      plan: 'monthly',
      provider: 'dodo',
      currentPeriodEnd: future,
    })
    expect(byId.get(noMembershipReaderId)?.membership).toBeNull()
  })

  it('filters by membershipStatus=active', async () => {
    const result = await readerRepository.list({
      page: 1,
      size: 100,
      membershipStatus: 'active',
    })
    expect(result.data.map((row) => row.id)).toEqual([activeReaderId])
  })

  it('filters by membershipStatus=on_hold', async () => {
    const result = await readerRepository.list({
      page: 1,
      size: 100,
      membershipStatus: 'on_hold',
    })
    expect(result.data.map((row) => row.id)).toEqual([onHoldReaderId])
  })

  it('filters by membershipStatus=cancelled', async () => {
    const result = await readerRepository.list({
      page: 1,
      size: 100,
      membershipStatus: 'cancelled',
    })
    expect(result.data.map((row) => row.id)).toEqual([cancelledReaderId])
  })

  it('filters by membershipStatus=expired (stored expired status or period passed)', async () => {
    const result = await readerRepository.list({
      page: 1,
      size: 100,
      membershipStatus: 'expired',
    })
    expect(new Set(result.data.map((row) => row.id))).toEqual(
      new Set([expiredStatusReaderId, expiredPeriodReaderId]),
    )
  })

  it('filters by membershipStatus=none', async () => {
    const result = await readerRepository.list({
      page: 1,
      size: 100,
      membershipStatus: 'none',
    })
    expect(result.data.map((row) => row.id)).toEqual([noMembershipReaderId])
  })
})
