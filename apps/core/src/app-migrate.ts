/**
 * App-data migration runner.
 *
 * Boots a Nest application context (so migrations can `app.get(Service)` and
 * use real DI graph), acquires a Postgres advisory lock distinct from the
 * schema-migration lock, then iterates the registry in sorted id order. Each
 * migration's `up()` is responsible for its own row-level idempotency; the
 * runner only uses the `_app_migrations` ledger to skip work on re-runs.
 *
 * Schema migrations must run first — `src/migrate.ts` chains both phases so
 * `node migrate.mjs` (and `pnpm migrate`) is enough. This file remains a
 * standalone entry as a dev escape hatch (`pnpm migrate:app`) and exposes
 * `runAppMigrations` for the combined runner.
 *
 * Mirrors the import-order trick in `main.ts`: `initializeApp()` MUST run
 * before AppModule (and anything in its graph) evaluates ambient globals
 * such as `isDev`. ESM hoists static imports, so the AppModule import is
 * deferred via dynamic `import()`.
 */
import 'dotenv-expand/config'

import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type pkg from 'pg'

import { initializeApp } from './global/index.global'

export async function runAppMigrations() {
  initializeApp()

  const [
    { AppModule },
    { PG_DB_TOKEN, PG_POOL_TOKEN },
    { migrations },
    { appMigrations: ledgerTable },
    { APP_MIGRATION_LOCK_KEY, withAdvisoryLock },
  ] = await Promise.all([
    import('./app.module'),
    import('./constants/system.constant'),
    import('./database/app-migrations/registry'),
    import('./database/schema'),
    import('./processors/database/postgres.lock'),
  ])

  const app = await NestFactory.createApplicationContext(
    AppModule.register(false),
    {
      logger: ['error', 'warn', 'log'],
    },
  )
  const logger = new Logger('app-migrate')
  const db = app.get(
    PG_DB_TOKEN,
  ) as import('./processors/database/postgres.provider').AppDatabase
  const pool = app.get<pkg.Pool>(PG_POOL_TOKEN)

  try {
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
  } finally {
    await app.close()
  }
}

function isCliEntry(): boolean {
  try {
    const here = fileURLToPath(import.meta.url)
    const entry = process.argv[1] ? path.resolve(process.argv[1]) : ''
    return here === entry
  } catch {
    return false
  }
}

if (isCliEntry()) {
  runAppMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[app-migrate] failed:', err)
      process.exit(1)
    })
}
