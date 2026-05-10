import type { Logger } from '@nestjs/common'
import type pkg from 'pg'

import type { AppDatabase } from '~/processors/database/postgres.provider'

/**
 * App-data migration: a one-time runtime transform applied against an already
 * migrated schema. Distinct from drizzle-kit DDL migrations.
 *
 * `up` runs inside a Postgres advisory lock, so concurrent runners will not
 * race. Each implementation MUST be idempotent: a re-run after partial
 * failure or a second instance starting before the ledger row was written
 * must produce the same end state. Runner-level guard is the ledger; the
 * row-level guard is the migration's responsibility.
 *
 * The migration receives `db` and `pool` directly — NOT the full Nest
 * application context. This keeps app-migrations infrastructure-only: the
 * runner can boot a slim module (no AuthModule, ImageService, GatewayModule,
 * etc.) so a one-shot mx-migrate container does not pay the cost of the
 * server's DI graph nor trigger heavy onModuleInit side effects (e.g. sharp
 * native install). Migrations that need URL matching, slug parsing, or other
 * pure logic should import shared utilities; anything that needs network IO
 * (e.g. enrichment resolve) belongs in a live-server background task, not in
 * release-phase migrations.
 */
export interface AppMigration {
  /** Stable id, `YYYYMMDD-slug`. Used as ledger primary key. */
  id: string
  description: string
  up: (ctx: {
    db: AppDatabase
    pool: pkg.Pool
    logger: Logger
  }) => Promise<void>
}
