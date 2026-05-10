/**
 * App-data migration runner (standalone CLI).
 *
 * Boots a SLIM Nest application context (`MigrationsAppModule`) — only the
 * postgres providers and the app-migrations runner. Critically, this does
 * NOT pull AppModule, so onModuleInit side effects from business services
 * (sharp install, Better Auth init, GatewayModule, TaskQueueModule, cron,
 * email, etc.) never fire. The mx-migrate one-shot container in
 * docker-compose.yml uses this entry, so a release-phase migration cannot
 * be bricked by an unrelated business module's boot path.
 *
 * Schema migrations must run first — `src/migrate.ts` chains both phases so
 * `node migrate.mjs` (and `pnpm migrate`) is enough. This file remains a
 * standalone entry as a dev / ops escape hatch (`pnpm migrate:app`) and
 * exposes `runAppMigrations` for the combined runner.
 *
 * Mirrors the import-order trick in `main.ts`: `initializeApp()` MUST run
 * before MigrationsAppModule (and anything in its graph) evaluates ambient
 * globals such as `isDev`. ESM hoists static imports, so the module import
 * is deferred via dynamic `import()`.
 */
import 'dotenv-expand/config'

import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { NestFactory } from '@nestjs/core'

import { initializeApp } from './global/index.global'

export async function runAppMigrations() {
  initializeApp()

  const [{ MigrationsAppModule }, { AppMigrationsService }] = await Promise.all(
    [
      import('./migrations-app.module'),
      import('./database/app-migrations/app-migrations.service'),
    ],
  )

  const app = await NestFactory.createApplicationContext(MigrationsAppModule, {
    logger: ['error', 'warn', 'log'],
  })

  try {
    await app.get(AppMigrationsService).run()
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
