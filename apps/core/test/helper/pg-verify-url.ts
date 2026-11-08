import path from 'node:path'

import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import * as schema from '~/database/schema'
import { runSchemaMigrationFiles } from '~/processors/database/schema-migrator'
import { CONFIG_FORMAT_MIGRATION_ID } from '~/shared/config-format'

export function requirePgVerifyUrl() {
  const verifyUrl = process.env.PG_VERIFY_URL
  if (!verifyUrl) {
    throw new Error(
      'PG_VERIFY_URL is required for PostgreSQL integration tests',
    )
  }
  return verifyUrl
}

interface PgTestDatabaseOptions {
  migrate?: boolean
  configCurrent?: boolean
}

export interface PgTestDatabase {
  connectionString: string
  db: NodePgDatabase<typeof schema>
  pool: Pool
  close: () => Promise<void>
}

const quoteIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`

export async function createPgTestDatabase(
  prefix: string,
  options: PgTestDatabaseOptions = {},
): Promise<PgTestDatabase> {
  const baseUrl = requirePgVerifyUrl()
  const adminPool = new Pool({ connectionString: baseUrl, max: 1 })
  const dbName = `${prefix}_${process.pid}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`.replaceAll('-', '_')
  const quotedDbName = quoteIdentifier(dbName)

  const url = new URL(baseUrl)
  url.pathname = `/${dbName}`
  const connectionString = url.toString()
  const pool = new Pool({ connectionString, max: 2 })
  let closed = false
  let created = false

  const close = async () => {
    if (closed) {
      return
    }
    closed = true
    try {
      await pool.end()
      if (created) {
        await adminPool.query(`DROP DATABASE ${quotedDbName}`)
      }
    } finally {
      await adminPool.end()
    }
  }

  try {
    await adminPool.query(`CREATE DATABASE ${quotedDbName}`)
    created = true
    const db = drizzle(pool, { schema, casing: 'snake_case' })

    if (options.migrate !== false) {
      const migrationsFolder = path.resolve(
        __dirname,
        '../../src/database/migrations',
      )
      await runSchemaMigrationFiles(pool, migrationsFolder)
      // Runtime configuration fixtures opt in to the current app-data marker.
      // Schema-only and migration regression fixtures remain unprepared.
      if (options.configCurrent === true)
        await pool.query('INSERT INTO _app_migrations (id) VALUES ($1)', [
          CONFIG_FORMAT_MIGRATION_ID,
        ])
    }

    return {
      close,
      connectionString,
      db,
      pool,
    }
  } catch (error) {
    await close()
    throw error
  }
}
