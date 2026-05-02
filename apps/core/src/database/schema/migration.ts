import {
  bigint,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

import { createdAt, pkBigInt, tsCol } from './columns'

/**
 * Tracks which one-time data migration scripts have run. Distinct from the
 * `__drizzle_migrations` table that drizzle-kit owns for schema DDL.
 */
export const schemaMigrations = pgTable('schema_migrations', {
  name: text('name').primaryKey(),
  appliedAt: timestamp('applied_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
})

/**
 * Maps source MongoDB ObjectId values to allocated Snowflake IDs so the data
 * migration tool can deterministically rewrite cross-collection references.
 */
export const mongoIdMap = pgTable(
  'mongo_id_map',
  {
    collection: text('collection').notNull(),
    mongoId: text('mongo_id').notNull(),
    snowflakeId: bigint('snowflake_id', { mode: 'bigint' }).notNull(),
  },
  (table) => [
    uniqueIndex('mongo_id_map_pk').on(table.collection, table.mongoId),
    uniqueIndex('mongo_id_map_snowflake_uniq').on(table.snowflakeId),
  ],
)

export const dataMigrationRuns = pgTable('data_migration_runs', {
  id: pkBigInt(),
  name: text('name').notNull(),
  startedAt: createdAt('started_at'),
  finishedAt: tsCol('finished_at'),
  status: text('status').notNull(),
  error: text('error'),
})
