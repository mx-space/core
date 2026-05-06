import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core'

import { createdAt, pkText } from './columns'

export const enrichmentCache = pgTable(
  'enrichment_cache',
  {
    id: pkText(),
    provider: varchar('provider', { length: 64 }).notNull(),
    externalId: varchar('external_id', { length: 256 }).notNull(),
    url: text('url').notNull(),

    normalized: jsonb('normalized').$type<Record<string, unknown>>().notNull(),
    raw: jsonb('raw'),

    fetchedAt: timestamp('fetched_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }),
    failureCount: integer('failure_count').notNull().default(0),
    lastError: text('last_error'),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('enrichment_provider_external_id_uniq').on(
      table.provider,
      table.externalId,
    ),
    index('enrichment_expires_at_idx').on(table.expiresAt),
  ],
)
