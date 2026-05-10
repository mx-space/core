/**
 * App-data migration runner (standalone CLI).
 *
 * Boots a Nest application context (so migrations can `app.get(Service)` and
 * use real DI graph), then delegates to `AppMigrationsService.run`. The
 * service holds the canonical advisory-lock + ledger logic; in dev that
 * same service runs inline from `bootstrap.ts`.
 *
 * Schema migrations must run first — `src/migrate.ts` chains both phases so
 * `node migrate.mjs` (and `pnpm migrate`) is enough. This file remains a
 * standalone entry as a dev / ops escape hatch (`pnpm migrate:app`) and
 * exposes `runAppMigrations` for the combined runner.
 *
 * Mirrors the import-order trick in `main.ts`: `initializeApp()` MUST run
 * before AppModule (and anything in its graph) evaluates ambient globals
 * such as `isDev`. ESM hoists static imports, so the AppModule import is
 * deferred via dynamic `import()`.
 */
import 'dotenv-expand/config'

import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { NestFactory } from '@nestjs/core'

import { initializeApp } from './global/index.global'

export async function runAppMigrations() {
  initializeApp()

  const [{ AppModule }, { AppMigrationsService }] = await Promise.all([
    import('./app.module'),
    import('./database/app-migrations/app-migrations.service'),
  ])

  const app = await NestFactory.createApplicationContext(
    AppModule.register(false),
    {
      logger: ['error', 'warn', 'log'],
    },
  )

  try {
    await app.get(AppMigrationsService).run(app)
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
