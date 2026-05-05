#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Mongo → PostgreSQL data migration CLI.
 *
 * Usage:
 *   mx-mongo-pg-migrate --mode dry-run
 *   mx-mongo-pg-migrate --mode apply
 *
 * Environment variables:
 *   MONGO_URI              source MongoDB connection string
 *   PG_URL / PG_*          target PostgreSQL settings
 *   MIGRATIONS_DIR         optional override of the Drizzle migrations folder
 *                          applied during `--mode apply` (defaults to
 *                          ./migrations relative to the bundled CLI)
 *   SNOWFLAKE_WORKER_ID    worker id for migration-generated rows; reserve 900-999
 *
 * The dry-run mode reads the source database, allocates Snowflake IDs in memory,
 * resolves all references to validate they will succeed, and emits the same
 * report that apply mode would produce — but writes nothing to PostgreSQL.
 */
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import * as schema from '@mx-space/db-schema/schema'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { MongoClient } from 'mongodb'
import pkg from 'pg'

import { formatReport, runMigration } from './runner'

const { Pool } = pkg

const cliArgs = process.argv.slice(2)
const modeIdx = cliArgs.indexOf('--mode')
const mode =
  modeIdx >= 0
    ? (cliArgs[modeIdx + 1] as 'dry-run' | 'apply')
    : ('dry-run' as const)

if (mode !== 'dry-run' && mode !== 'apply') {
  console.error(`unknown mode "${mode}" (expected dry-run | apply)`)
  process.exit(2)
}

const mongoUri =
  process.env.MONGO_URI ||
  process.env.DB_CONNECTION_STRING ||
  'mongodb://127.0.0.1:27017/mx-space'

const pgUrl =
  process.env.PG_URL ||
  process.env.PG_CONNECTION_STRING ||
  `postgres://${process.env.PG_USER ?? 'mx'}:${process.env.PG_PASSWORD ?? 'mx'}@${process.env.PG_HOST ?? '127.0.0.1'}:${process.env.PG_PORT ?? 5432}/${process.env.PG_DATABASE ?? 'mx_core'}`

const summarizeUrl = (raw: string): string => {
  try {
    const u = new URL(raw)
    const target = u.pathname.replace(/^\//, '') || '(default)'
    return `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ''}/${target}`
  } catch {
    return '(unparsable URL — connection details elided)'
  }
}

const resolveMigrationsFolder = (): string => {
  if (process.env.MIGRATIONS_DIR)
    return path.resolve(process.env.MIGRATIONS_DIR)
  // Default: ./migrations relative to the bundled CLI file.
  const here = path.dirname(fileURLToPath(import.meta.url))
  return path.resolve(here, 'migrations')
}

async function main() {
  console.log(`Mongo → PostgreSQL migration (${mode})`)
  console.log(`  mongo: ${summarizeUrl(mongoUri)}`)
  console.log(`  pg:    ${summarizeUrl(pgUrl)}`)

  const mongo = new MongoClient(mongoUri)
  await mongo.connect()
  const mongoDb = mongo.db()

  const pool = new Pool({ connectionString: pgUrl })
  const pg = drizzle(pool, { schema, casing: 'snake_case' })

  if (mode === 'apply') {
    const migrationsFolder = resolveMigrationsFolder()
    console.log(`  applying schema migrations from ${migrationsFolder}`)
    await migrate(pg, { migrationsFolder })
  }

  try {
    const report = await runMigration({
      mode,
      mongo: mongoDb,
      pg,
      workerId: Number(process.env.SNOWFLAKE_WORKER_ID ?? 900),
    })
    console.log('\n' + formatReport(report))
    if (report.missingRefs.length > 0) {
      console.warn(
        `\n⚠️  ${report.missingRefs.length} missing references — review before proceeding to apply mode.`,
      )
      process.exitCode = 1
    } else {
      console.log('\n✅ Migration finished without missing references.')
    }
  } finally {
    await mongo.close()
    await pool.end()
  }
}

main().catch((err) => {
  console.error('migration failed:', err)
  process.exit(1)
})
