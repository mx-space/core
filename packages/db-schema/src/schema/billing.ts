import { sql } from 'drizzle-orm'
import { jsonb, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core'

import { readers } from './auth'
import { createdAt, pkText, refText, tsCol, updatedAt } from './columns'

export const memberships = pgTable(
  'memberships',
  {
    id: pkText(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    readerId: refText('reader_id')
      .notNull()
      .references(() => readers.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    providerCustomerId: text('provider_customer_id'),
    providerSubscriptionId: text('provider_subscription_id'),
    plan: text('plan').notNull(),
    status: text('status').notNull(),
    currentPeriodEnd: tsCol('current_period_end').notNull(),
  },
  (table) => [
    uniqueIndex('memberships_reader_id_uniq').on(table.readerId),
    uniqueIndex('memberships_provider_subscription_id_uniq')
      .on(table.providerSubscriptionId)
      .where(sql`${table.providerSubscriptionId} is not null`),
  ],
)

export const billingWebhookEvents = pgTable(
  'billing_webhook_events',
  {
    id: pkText(),
    provider: text('provider').notNull(),
    eventId: text('event_id').notNull(),
    type: text('type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    processedAt: tsCol('processed_at'),
    receivedAt: createdAt('received_at'),
  },
  (table) => [
    uniqueIndex('billing_webhook_events_provider_event_id_uniq').on(
      table.provider,
      table.eventId,
    ),
  ],
)
