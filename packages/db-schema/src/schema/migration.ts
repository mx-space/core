import { pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

import { createdAt, pkText, tsCol } from './columns'

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
 * Migration-only audit map from source MongoDB ObjectId values to allocated
 * Snowflake text IDs. Business runtime code must not query this table.
 */
export const mongoIdMap = pgTable(
  'mongo_id_map',
  {
    collection: text('collection').notNull(),
    mongoId: text('mongo_id').notNull(),
    snowflakeId: text('snowflake_id').notNull(),
  },
  (table) => [
    uniqueIndex('mongo_id_map_pk').on(table.collection, table.mongoId),
    uniqueIndex('mongo_id_map_snowflake_uniq').on(table.snowflakeId),
  ],
)

export const authIdMap = pgTable(
  'auth_id_map',
  {
    collection: text('collection').notNull(),
    mongoId: text('mongo_id').notNull(),
    pgId: text('pg_id').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('auth_id_map_collection_mongo_uniq').on(
      table.collection,
      table.mongoId,
    ),
    uniqueIndex('auth_id_map_collection_pg_uniq').on(
      table.collection,
      table.pgId,
    ),
  ],
)

export const dataMigrationRuns = pgTable('data_migration_runs', {
  id: pkText(),
  name: text('name').notNull(),
  startedAt: createdAt('started_at'),
  finishedAt: tsCol('finished_at'),
  status: text('status').notNull(),
  error: text('error'),
})
