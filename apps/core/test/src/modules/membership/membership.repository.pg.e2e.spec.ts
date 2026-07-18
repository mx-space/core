import * as schema from '@mx-space/db-schema/schema'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { createIsolatedPgDatabase } from 'test/helper/pg-testcontainer'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { BillingWebhookEventRepository } from '~/modules/membership/billing-webhook-event.repository'
import { MembershipRepository } from '~/modules/membership/membership.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { SnowflakeService } from '~/shared/id/snowflake.service'

describe('Membership + billing webhook event repositories (real PG)', () => {
  let pool: Pool
  let database: Awaited<ReturnType<typeof createIsolatedPgDatabase>>
  let membershipRepository: MembershipRepository
  let billingWebhookEventRepository: BillingWebhookEventRepository
  const snowflake = new SnowflakeService()
  const readerId = snowflake.nextId()
  const otherReaderId = snowflake.nextId()

  beforeAll(async () => {
    database = await createIsolatedPgDatabase()
    pool = new Pool({ connectionString: database.getConnectionUri(), max: 4 })
    const db = drizzle(pool, { schema }) as unknown as AppDatabase
    membershipRepository = new MembershipRepository(db, snowflake)
    billingWebhookEventRepository = new BillingWebhookEventRepository(
      db,
      snowflake,
    )
    await db.insert(schema.readers).values([
      { id: readerId, name: 'Reader One', role: 'reader' },
      { id: otherReaderId, name: 'Reader Two', role: 'reader' },
    ])
  }, 120_000)

  afterAll(async () => {
    await pool?.end()
    await database?.drop()
  })

  it('creates, reads, updates and deletes a membership', async () => {
    const currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    const created = await membershipRepository.create({
      readerId,
      provider: 'dodo',
      providerCustomerId: 'cus_123',
      providerSubscriptionId: 'sub_123',
      plan: 'monthly',
      status: 'active',
      currentPeriodEnd,
    })

    expect(created.readerId).toBe(readerId)
    expect(created.status).toBe('active')

    await expect(membershipRepository.findById(created.id)).resolves.toEqual(
      created,
    )
    await expect(
      membershipRepository.findByReaderId(readerId),
    ).resolves.toEqual(created)
    await expect(
      membershipRepository.findByProviderSubscriptionId('sub_123'),
    ).resolves.toEqual(created)

    const updated = await membershipRepository.update(created.id, {
      status: 'on_hold',
    })
    expect(updated?.status).toBe('on_hold')
    expect(updated?.updatedAt).not.toBeNull()

    const deleted = await membershipRepository.deleteById(created.id)
    expect(deleted?.id).toBe(created.id)
    await expect(membershipRepository.findById(created.id)).resolves.toBeNull()
  })

  it('rejects a second membership for the same reader (unique reader_id)', async () => {
    const currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    await membershipRepository.create({
      readerId: otherReaderId,
      provider: 'manual',
      plan: 'yearly',
      status: 'active',
      currentPeriodEnd,
    })

    await expect(
      membershipRepository.create({
        readerId: otherReaderId,
        provider: 'manual',
        plan: 'monthly',
        status: 'active',
        currentPeriodEnd,
      }),
    ).rejects.toThrow()
  })

  it('rejects a second membership with the same provider_subscription_id', async () => {
    const readerA = snowflake.nextId()
    const readerB = snowflake.nextId()
    const db = drizzle(pool, { schema }) as unknown as AppDatabase
    await db.insert(schema.readers).values([
      { id: readerA, name: 'Reader A', role: 'reader' },
      { id: readerB, name: 'Reader B', role: 'reader' },
    ])

    const currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    await membershipRepository.create({
      readerId: readerA,
      provider: 'dodo',
      providerSubscriptionId: 'sub_dup',
      plan: 'monthly',
      status: 'active',
      currentPeriodEnd,
    })

    await expect(
      membershipRepository.create({
        readerId: readerB,
        provider: 'dodo',
        providerSubscriptionId: 'sub_dup',
        plan: 'monthly',
        status: 'active',
        currentPeriodEnd,
      }),
    ).rejects.toThrow()
  })

  it('creates and reads billing webhook events, skipping duplicates', async () => {
    const created = await billingWebhookEventRepository.create({
      provider: 'dodo',
      eventId: 'evt_123',
      type: 'subscription.active',
      payload: { hello: 'world' },
    })

    expect(created.processedAt).toBeNull()

    await expect(
      billingWebhookEventRepository.findByProviderAndEventId('dodo', 'evt_123'),
    ).resolves.toEqual(created)

    const processedAt = new Date()
    const processed = await billingWebhookEventRepository.markProcessed(
      created.id,
      processedAt,
    )
    expect(processed?.processedAt?.toISOString()).toBe(
      processedAt.toISOString(),
    )
  })

  it('skips a duplicate (provider, event_id) insert without throwing', async () => {
    const first = await billingWebhookEventRepository.create({
      provider: 'dodo',
      eventId: 'evt_dup',
      type: 'subscription.renewed',
      payload: {},
    })
    expect(first).not.toBeNull()

    const second = await billingWebhookEventRepository.create({
      provider: 'dodo',
      eventId: 'evt_dup',
      type: 'subscription.renewed',
      payload: {},
    })
    expect(second).toBeNull()

    const results = await Promise.allSettled([
      billingWebhookEventRepository.create({
        provider: 'dodo',
        eventId: 'evt_concurrent',
        type: 'subscription.renewed',
        payload: {},
      }),
      billingWebhookEventRepository.create({
        provider: 'dodo',
        eventId: 'evt_concurrent',
        type: 'subscription.renewed',
        payload: {},
      }),
    ])

    const fulfilled = results.filter((r) => r.status === 'fulfilled') as Array<
      PromiseFulfilledResult<
        Awaited<ReturnType<typeof billingWebhookEventRepository.create>>
      >
    >
    expect(fulfilled).toHaveLength(2)
    const wins = fulfilled.filter((r) => r.value !== null)
    const losses = fulfilled.filter((r) => r.value === null)
    expect(wins).toHaveLength(1)
    expect(losses).toHaveLength(1)
  })
})
