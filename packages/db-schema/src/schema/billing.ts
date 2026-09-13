import { sql } from 'drizzle-orm'
import { integer, jsonb, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core'

import { readers } from './auth'
import { createdAt, pkText, refText, tsCol, updatedAt } from './columns'
import { posts } from './content'

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

export const articlePurchases = pgTable(
  'article_purchases',
  {
    id: pkText(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    readerId: refText('reader_id')
      .notNull()
      .references(() => readers.id, { onDelete: 'cascade' }),
    postId: refText('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    providerPaymentId: text('provider_payment_id').notNull(),
    providerCustomerId: text('provider_customer_id'),
    amount: integer('amount').notNull(),
    currency: text('currency').notNull(),
    status: text('status').notNull(),
  },
  (table) => [
    uniqueIndex('article_purchases_reader_id_post_id_uniq').on(
      table.readerId,
      table.postId,
    ),
    uniqueIndex('article_purchases_provider_payment_id_uniq').on(
      table.provider,
      table.providerPaymentId,
    ),
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
