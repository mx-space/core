import path from 'node:path'

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate as drizzleMigrate } from 'drizzle-orm/node-postgres/migrator'
import pkg from 'pg'

import * as schema from '~/database/schema'

const { Pool } = pkg

let container: StartedPostgreSqlContainer | undefined

export async function startPgTestContainer() {
  if (container) {
    return container
  }

  container = await new PostgreSqlContainer('postgres:17-alpine')
    .withDatabase('mx_verify')
    .withUsername('mx')
    .withPassword('mx')
    .start()

  const connectionUri = container.getConnectionUri()
  process.env.PG_URL = connectionUri
  process.env.PG_CONNECTION_STRING = connectionUri
  process.env.PG_VERIFY_URL = connectionUri
  process.env.POSTGRES_URL = connectionUri

  // Apply bundled drizzle migrations so the assertSchemaCurrent boot guard
  // (in postgres.provider.ts) passes for tests that go through the Nest module
  // initialization path.
  const migrationsFolder = path.resolve(
    __dirname,
    '../../src/database/migrations',
  )
  const pool = new Pool({ connectionString: connectionUri, max: 2 })
  try {
    const db = drizzle(pool, { schema, casing: 'snake_case' })
    await drizzleMigrate(db, { migrationsFolder })
  } finally {
    await pool.end()
  }

  return container
}

export async function stopPgTestContainer() {
  if (!container) {
    return
  }

  await container.stop()
  container = undefined
}
