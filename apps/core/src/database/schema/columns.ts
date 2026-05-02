import { bigint, timestamp } from 'drizzle-orm/pg-core'

/**
 * Snowflake primary key column. Always returned as `bigint` from drizzle;
 * repositories convert to {@link EntityId} string before crossing module boundaries.
 */
export const pkBigInt = (name = 'id') =>
  bigint(name, { mode: 'bigint' }).primaryKey().notNull()

/**
 * Foreign-key/reference Snowflake column. `mode: 'bigint'` avoids
 * JavaScript number precision loss outside `Number.MAX_SAFE_INTEGER`.
 */
export const refBigInt = (name: string) => bigint(name, { mode: 'bigint' })

export const createdAt = (name = 'created_at') =>
  timestamp(name, { withTimezone: true, mode: 'date' }).defaultNow().notNull()

export const updatedAt = (name = 'updated_at') =>
  timestamp(name, { withTimezone: true, mode: 'date' })

export const tsCol = (name: string) =>
  timestamp(name, { withTimezone: true, mode: 'date' })
