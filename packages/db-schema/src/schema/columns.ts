import { customType, text, timestamp } from 'drizzle-orm/pg-core'

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

/**
 * pgvector column. Dimension-less at the type level so multiple embedding
 * models can coexist; each row records its own `embedding_model` and `dim`.
 */
export const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector'
  },
  toDriver(value) {
    if (!Array.isArray(value)) {
      throw new TypeError('vector expects number[]')
    }
    return `[${value.join(',')}]`
  },
  fromDriver(value) {
    if (typeof value !== 'string') {
      throw new TypeError('expected pgvector string repr')
    }
    return JSON.parse(value) as number[]
  },
})
