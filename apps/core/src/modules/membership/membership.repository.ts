import { Inject, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { memberships } from '~/database/schema'
import {
  BaseRepository,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { type EntityId, parseEntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

import type {
  MembershipPlan,
  MembershipProvider,
  MembershipRow,
  MembershipStatus,
} from './membership.types'

const mapRow = (row: typeof memberships.$inferSelect): MembershipRow => ({
  id: toEntityId(row.id) as EntityId,
  readerId: toEntityId(row.readerId) as EntityId,
  provider: row.provider as MembershipProvider,
  providerCustomerId: row.providerCustomerId,
  providerSubscriptionId: row.providerSubscriptionId,
  plan: row.plan as MembershipPlan,
  status: row.status as MembershipStatus,
  currentPeriodEnd: row.currentPeriodEnd,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})

@Injectable()
export class MembershipRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  async create(input: {
    readerId: EntityId | string
    provider: MembershipProvider
    providerCustomerId?: string | null
    providerSubscriptionId?: string | null
    plan: MembershipPlan
    status: MembershipStatus
    currentPeriodEnd: Date
  }): Promise<MembershipRow> {
    const id = this.snowflake.nextId()
    const [row] = await this.db
      .insert(memberships)
      .values({
        id,
        readerId: parseEntityId(input.readerId),
        provider: input.provider,
        providerCustomerId: input.providerCustomerId ?? null,
        providerSubscriptionId: input.providerSubscriptionId ?? null,
        plan: input.plan,
        status: input.status,
        currentPeriodEnd: input.currentPeriodEnd,
      })
      .returning()
    return mapRow(row)
  }

  async findById(id: EntityId | string): Promise<MembershipRow | null> {
    const [row] = await this.db
      .select()
      .from(memberships)
      .where(eq(memberships.id, parseEntityId(id)))
      .limit(1)
    return row ? mapRow(row) : null
  }

  async findByReaderId(
    readerId: EntityId | string,
  ): Promise<MembershipRow | null> {
    const [row] = await this.db
      .select()
      .from(memberships)
      .where(eq(memberships.readerId, parseEntityId(readerId)))
      .limit(1)
    return row ? mapRow(row) : null
  }

  async findByProviderSubscriptionId(
    providerSubscriptionId: string,
  ): Promise<MembershipRow | null> {
    const [row] = await this.db
      .select()
      .from(memberships)
      .where(eq(memberships.providerSubscriptionId, providerSubscriptionId))
      .limit(1)
    return row ? mapRow(row) : null
  }

  async update(
    id: EntityId | string,
    patch: Partial<{
      provider: MembershipProvider
      providerCustomerId: string | null
      providerSubscriptionId: string | null
      plan: MembershipPlan
      status: MembershipStatus
      currentPeriodEnd: Date
    }>,
  ): Promise<MembershipRow | null> {
    const update: Partial<typeof memberships.$inferInsert> = {
      updatedAt: new Date(),
    }
    if (patch.provider !== undefined) update.provider = patch.provider
    if (patch.providerCustomerId !== undefined)
      update.providerCustomerId = patch.providerCustomerId
    if (patch.providerSubscriptionId !== undefined)
      update.providerSubscriptionId = patch.providerSubscriptionId
    if (patch.plan !== undefined) update.plan = patch.plan
    if (patch.status !== undefined) update.status = patch.status
    if (patch.currentPeriodEnd !== undefined)
      update.currentPeriodEnd = patch.currentPeriodEnd
    const [row] = await this.db
      .update(memberships)
      .set(update)
      .where(eq(memberships.id, parseEntityId(id)))
      .returning()
    return row ? mapRow(row) : null
  }

  async deleteById(id: EntityId | string): Promise<MembershipRow | null> {
    const [row] = await this.db
      .delete(memberships)
      .where(eq(memberships.id, parseEntityId(id)))
      .returning()
    return row ? mapRow(row) : null
  }
}
