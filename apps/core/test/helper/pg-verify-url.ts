import path from 'node:path'

import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { migrate as drizzleMigrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'

import * as schema from '~/database/schema'

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
        await adminPool.query(`DROP DATABASE ${quotedDbName} WITH (FORCE)`)
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
      await drizzleMigrate(db, { migrationsFolder })
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
