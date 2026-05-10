import type { INestApplicationContext } from '@nestjs/common'
import { Inject, Injectable, Logger } from '@nestjs/common'
import type pkg from 'pg'

import { PG_DB_TOKEN, PG_POOL_TOKEN } from '~/constants/system.constant'
import {
  APP_MIGRATION_LOCK_KEY,
  withAdvisoryLock,
} from '~/processors/database/postgres.lock'
import type { AppDatabase } from '~/processors/database/postgres.provider'

import { appMigrations as ledgerTable } from '../schema'
import { migrations } from './registry'

/**
 * Runs app-data migrations against the running Nest application's DI graph.
 *
 * Execution model is identical to the legacy standalone `runAppMigrations`:
 * acquire an advisory lock, list ledger rows, iterate the registry sorted by
 * id, run pending `m.up({ app, logger })` calls, write a ledger row per
 * success. The advisory lock + ledger combination makes the call safe to
 * fire from multiple replicas / cluster workers concurrently.
 *
 * In dev, this fires inline from `bootstrap.ts` so a single `vite-node`
 * process handles schema migrations (via `dev.ts`) + app-data migrations +
 * server boot. In prod, this runs from the standalone `app-migrate.ts` CLI
 * (invoked by docker `mx-migrate` via `migrate.mjs`).
 */
@Injectable()
export class AppMigrationsService {
  private readonly logger = new Logger(AppMigrationsService.name)

  constructor(
    @Inject(PG_DB_TOKEN) private readonly db: AppDatabase,
    @Inject(PG_POOL_TOKEN) private readonly pool: pkg.Pool,
  ) {}

  async run(app: INestApplicationContext): Promise<void> {
    const { db, pool, logger } = this
    await withAdvisoryLock(pool, APP_MIGRATION_LOCK_KEY, async () => {
      const appliedRows = await db
        .select({ id: ledgerTable.id })
        .from(ledgerTable)
      const applied = new Set(appliedRows.map((r) => r.id))

      const sorted = [...migrations].sort((a, b) => a.id.localeCompare(b.id))
      for (const m of sorted) {
        if (applied.has(m.id)) {
          logger.log(`⊘ ${m.id} (already applied)`)
          continue
        }
        logger.log(`▶ ${m.id} — ${m.description}`)
        const start = Date.now()
        try {
          await m.up({ app, logger })
          const ms = Date.now() - start
          await db.insert(ledgerTable).values({ id: m.id, durationMs: ms })
          logger.log(`✓ ${m.id} (${ms}ms)`)
        } catch (err) {
          logger.error(`✗ ${m.id}`, err as Error)
          throw err
        }
      }
    })
  }
}
