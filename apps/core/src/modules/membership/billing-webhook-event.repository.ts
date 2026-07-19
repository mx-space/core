import { Inject, Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { billingWebhookEvents } from '~/database/schema'
import {
  BaseRepository,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { type EntityId, parseEntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

import type { BillingWebhookEventRow } from './membership.types'

const mapRow = (
  row: typeof billingWebhookEvents.$inferSelect,
): BillingWebhookEventRow => ({
  id: toEntityId(row.id) as EntityId,
  provider: row.provider,
  eventId: row.eventId,
  type: row.type,
  payload: row.payload,
  processedAt: row.processedAt,
  receivedAt: row.receivedAt,
})

@Injectable()
export class BillingWebhookEventRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  async create(input: {
    provider: string
    eventId: string
    type: string
    payload: unknown
    receivedAt?: Date
  }): Promise<BillingWebhookEventRow | null> {
    const id = this.snowflake.nextId()
    const [row] = await this.db
      .insert(billingWebhookEvents)
      .values({
        id,
        provider: input.provider,
        eventId: input.eventId,
        type: input.type,
        payload: input.payload as Record<string, unknown>,
        receivedAt: input.receivedAt ?? new Date(),
      })
      .onConflictDoNothing({
        target: [billingWebhookEvents.provider, billingWebhookEvents.eventId],
      })
      .returning()
    return row ? mapRow(row) : null
  }

  async findByProviderAndEventId(
    provider: string,
    eventId: string,
  ): Promise<BillingWebhookEventRow | null> {
    const [row] = await this.db
      .select()
      .from(billingWebhookEvents)
      .where(
        and(
          eq(billingWebhookEvents.provider, provider),
          eq(billingWebhookEvents.eventId, eventId),
        )!,
      )
      .limit(1)
    return row ? mapRow(row) : null
  }

  async markProcessed(
    id: EntityId | string,
    processedAt: Date,
  ): Promise<BillingWebhookEventRow | null> {
    const [row] = await this.db
      .update(billingWebhookEvents)
      .set({ processedAt })
      .where(eq(billingWebhookEvents.id, parseEntityId(id)))
      .returning()
    return row ? mapRow(row) : null
  }
}
