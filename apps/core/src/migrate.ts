/* eslint-disable no-console */
/**
 * Release-phase schema migration runner.
 *
 * Intentionally avoids importing `~/app.config` so this binary stays a
 * pure pre-deploy step — it must not require SNOWFLAKE_WORKER_ID,
 * JWT_SECRET, or any other runtime config that the app expects.
 */
import path from 'node:path'

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

async function main() {
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
  console.log(`[migrate] target=${target}`)
  console.log(`[migrate] folder=${migrationsFolder}`)
  const start = Date.now()
  try {
    await withAdvisoryLock(pool, SCHEMA_MIGRATION_LOCK_KEY, async () => {
      await drizzleMigrate(db, { migrationsFolder })
    })
    console.log(`[migrate] done in ${Date.now() - start}ms`)
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error('[migrate] failed:', err)
  process.exit(1)
})
