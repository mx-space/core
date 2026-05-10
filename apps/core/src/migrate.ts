/* eslint-disable no-console */
/**
 * Combined migration runner.
 *
 * Phase 1 — schema migrations (drizzle-kit): pure pre-deploy, holds its own
 *           advisory lock, no Nest boot. The schema phase intentionally avoids
 *           importing `~/app.config` so a failure here surfaces *before* any
 *           runtime config is touched.
 * Phase 2 — app-data migrations (`./app-migrate`): boots Nest, distinct
 *           advisory lock. Loaded via dynamic `import()` so its transitive
 *           `~/app.config` evaluation only fires after schema phase logs.
 *
 * Both phases must succeed for the binary to exit 0. `node migrate.mjs` (in
 * the docker image) and `pnpm migrate` (in dev) both run the chain via the
 * CLI guard at the bottom; importing this module from `dev.ts` only exposes
 * `runSchemaMigrations` and does NOT trigger the chain.
 */
import 'dotenv-expand/config'

import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate as drizzleMigrate } from 'drizzle-orm/node-postgres/migrator'
import pkg from 'pg'

import * as schema from '~/database/schema'
import {
  SCHEMA_MIGRATION_LOCK_KEY,
  withAdvisoryLock,
} from '~/processors/database/postgres.lock'

const { Pool } = pkg

function parseInt32(input: string | undefined, fallback: number): number {
  if (input === undefined || input === null || input === '') return fallback
  const n = Number(input)
  if (!Number.isInteger(n) || n <= 0) return fallback
  return n
}

function parseBoolish(v: string | undefined): boolean {
  if (!v) return false
  return ['true', '1', 'yes', 'on'].includes(v.toLowerCase())
}

function resolvePgConfig() {
  const connectionString =
    process.env.PG_URL || process.env.PG_CONNECTION_STRING
  return {
    connectionString,
    host: process.env.PG_HOST || '127.0.0.1',
    port: parseInt32(process.env.PG_PORT, 5432),
    user: process.env.PG_USER || 'mx',
    password: process.env.PG_PASSWORD || 'mx',
    database: process.env.PG_DATABASE || 'mx_core',
    ssl: parseBoolish(process.env.PG_SSL)
      ? { rejectUnauthorized: false }
      : false,
  } as const
}

function resolveMigrationsFolder(): string {
  return process.env.MIGRATIONS_DIR
    ? path.resolve(process.env.MIGRATIONS_DIR)
    : path.resolve(process.cwd(), 'src', 'database', 'migrations')
}

export async function runSchemaMigrations() {
  const cfg = resolvePgConfig()
  const pool = new Pool({
    connectionString: cfg.connectionString,
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    max: 2,
    ssl: cfg.ssl,
  })

  pool.on('error', (err) => {
    console.error('[migrate] pool error:', err)
  })

  const db = drizzle(pool, { schema, casing: 'snake_case' })
  const migrationsFolder = resolveMigrationsFolder()

  const target = cfg.connectionString
    ? cfg.connectionString.replace(/:[^/:@]+@/, ':***@')
    : `${cfg.host}:${cfg.port}/${cfg.database}`
  console.log(`[migrate] schema target=${target}`)
  console.log(`[migrate] schema folder=${migrationsFolder}`)
  const start = Date.now()
  try {
    await withAdvisoryLock(pool, SCHEMA_MIGRATION_LOCK_KEY, async () => {
      await drizzleMigrate(db, { migrationsFolder })
    })
    console.log(`[migrate] schema done in ${Date.now() - start}ms`)
  } finally {
    await pool.end()
  }
}

async function main() {
  await runSchemaMigrations()
  // Defer app-migrate so its transitive `~/app.config` evaluation (which
  // validates SNOWFLAKE_WORKER_ID etc.) only runs after schema phase.
  const { runAppMigrations } = await import('./app-migrate')
  await runAppMigrations()
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
  main()
    .then(() => {
      // Force exit even if app.close() left handles open. ImageService's
      // onModuleInit fires `requireDepsWithInstall('sharp')` which loads the
      // sharp native binding once installed; sharp's worker pool keeps the
      // event loop alive and migrate.mjs would otherwise hang here, blocking
      // `service_completed_successfully` for mx-server in compose.
      process.exit(0)
    })
    .catch((err) => {
      console.error('[migrate] failed:', err)
      process.exit(1)
    })
}
