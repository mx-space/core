import type { INestApplicationContext, Logger } from '@nestjs/common'

/**
 * App-data migration: a one-time runtime transform applied against an already
 * migrated schema. Distinct from drizzle-kit DDL migrations.
 *
 * `up` runs inside a Postgres advisory lock, so concurrent runners will not
 * race. Each implementation MUST be idempotent: a re-run after partial
 * failure or a second instance starting before the ledger row was written
 * must produce the same end state. Runner-level guard is the ledger; the
 * row-level guard is the migration's responsibility.
 */
export interface AppMigration {
  /** Stable id, `YYYYMMDD-slug`. Used as ledger primary key. */
  id: string
  description: string
  up: (ctx: { app: INestApplicationContext; logger: Logger }) => Promise<void>
}
