import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

import { readers } from './auth'
import { createdAt, tsCol, updatedAt } from './columns'

export type PushDeliveryStatus =
  'pending' | 'processing' | 'retrying' | 'delivered' | 'failed'

export const pushRelaySources = pgTable(
  'push_relay_sources',
  {
    id: text('id').primaryKey().notNull(),
    relayUrl: text('relay_url').notNull(),
    remoteSourceId: text('remote_source_id').notNull(),
    sourceSecret: text('source_secret').notNull(),
    eventEndpoint: text('event_endpoint').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('push_relay_sources_relay_url_uniq').on(table.relayUrl),
    uniqueIndex('push_relay_sources_remote_source_uniq').on(
      table.relayUrl,
      table.remoteSourceId,
    ),
    index('push_relay_sources_enabled_idx').on(table.enabled),
  ],
)

export const pushRelayBindings = pgTable(
  'push_relay_bindings',
  {
    id: text('id').primaryKey().notNull(),
    sourceId: text('source_id')
      .notNull()
      .references(() => pushRelaySources.id, { onDelete: 'cascade' }),
    remoteBindingId: text('remote_binding_id').notNull(),
    installationId: text('installation_id').notNull(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => readers.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    revokedAt: tsCol('revoked_at'),
  },
  (table) => [
    uniqueIndex('push_relay_bindings_remote_uniq').on(
      table.sourceId,
      table.remoteBindingId,
    ),
    uniqueIndex('push_relay_bindings_installation_uniq').on(
      table.sourceId,
      table.installationId,
    ),
    index('push_relay_bindings_owner_active_idx')
      .on(table.ownerId, table.createdAt)
      .where(sql`${table.revokedAt} is null`),
  ],
)

export const pushRelayDeliveries = pgTable(
  'push_relay_deliveries',
  {
    id: text('id').primaryKey().notNull(),
    sourceId: text('source_id')
      .notNull()
      .references(() => pushRelaySources.id, { onDelete: 'cascade' }),
    eventId: text('event_id').notNull(),
    eventType: text('event_type').notNull(),
    subject: text('subject').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    status: text('status')
      .$type<PushDeliveryStatus>()
      .notNull()
      .default('pending'),
    attempt: integer('attempt').notNull().default(0),
    nextAttemptAt: tsCol('next_attempt_at').notNull(),
    lastError: text('last_error'),
    deliveredAt: tsCol('delivered_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('push_relay_deliveries_event_uniq').on(
      table.sourceId,
      table.eventId,
    ),
    index('push_relay_deliveries_due_idx')
      .on(table.nextAttemptAt, table.createdAt)
      .where(sql`${table.status} in ('pending', 'retrying')`),
    check(
      'push_relay_deliveries_status_check',
      sql`${table.status} in ('pending', 'processing', 'retrying', 'delivered', 'failed')`,
    ),
    check('push_relay_deliveries_attempt_check', sql`${table.attempt} >= 0`),
  ],
)
