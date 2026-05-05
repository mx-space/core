/* eslint-disable no-console */
import path from 'node:path'

import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate as drizzleMigrate } from 'drizzle-orm/node-postgres/migrator'
import pkg from 'pg'

import { POSTGRES } from '~/app.config'
import * as schema from '~/database/schema'
import {
  SCHEMA_MIGRATION_LOCK_KEY,
  withAdvisoryLock,
} from '~/processors/database/postgres.lock'

const { Pool } = pkg

function resolveMigrationsFolder(): string {
  return process.env.MIGRATIONS_DIR
    ? path.resolve(process.env.MIGRATIONS_DIR)
    : path.resolve(process.cwd(), 'src', 'database', 'migrations')
}

async function main() {
  const pool = new Pool({
    connectionString: POSTGRES.connectionString,
    host: POSTGRES.host,
    port: POSTGRES.port,
    user: POSTGRES.user,
    password: POSTGRES.password,
    database: POSTGRES.database,
    max: 2,
    ssl: POSTGRES.ssl,
  })

  pool.on('error', (err) => {
    console.error('[migrate] pool error:', err)
  })

  const db = drizzle(pool, { schema, casing: 'snake_case' })
  const migrationsFolder = resolveMigrationsFolder()

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
