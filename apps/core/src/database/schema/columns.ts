import { bigint, text, timestamp } from 'drizzle-orm/pg-core'

/**
 * Snowflake primary key column stored as text. IDs are generated as Snowflake
 * decimal strings, but the database must treat them as opaque identifiers.
 */
export const pkText = (name = 'id') => text(name).primaryKey().notNull()

/**
 * Snowflake foreign-key/reference column stored as text. Direct PostgreSQL
 * foreign keys are still allowed when both sides use this helper.
 */
export const refText = (name: string) => text(name)

export const createdAt = (name = 'created_at') =>
  timestamp(name, { withTimezone: true, mode: 'date' }).defaultNow().notNull()

export const updatedAt = (name = 'updated_at') =>
  timestamp(name, { withTimezone: true, mode: 'date' })

export const tsCol = (name: string) =>
  timestamp(name, { withTimezone: true, mode: 'date' })
