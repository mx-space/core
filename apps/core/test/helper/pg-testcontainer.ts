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

interface PgTestDatabase {
  getConnectionUri(): string
}

let container: StartedPostgreSqlContainer | undefined
let externalDatabase: PgTestDatabase | undefined
let migrationsApplied = false

const applyMigrations = async (connectionUri: string) => {
  if (migrationsApplied) {
    return
  }

  const migrationsFolder = path.resolve(
    __dirname,
    '../../src/database/migrations',
  )
  const pool = new Pool({ connectionString: connectionUri, max: 2 })
  try {
    const db = drizzle(pool, { schema, casing: 'snake_case' })
    await drizzleMigrate(db, { migrationsFolder })
    migrationsApplied = true
  } finally {
    await pool.end()
  }
}

const setPostgresEnv = (connectionUri: string) => {
  process.env.PG_URL = connectionUri
  process.env.PG_CONNECTION_STRING = connectionUri
  process.env.PG_VERIFY_URL = connectionUri
  process.env.POSTGRES_URL = connectionUri
}

export async function startPgTestContainer(): Promise<PgTestDatabase> {
  if (container) {
    return container
  }

  const externalConnectionUri = process.env.PG_VERIFY_URL
  if (externalConnectionUri) {
    if (!externalDatabase) {
      setPostgresEnv(externalConnectionUri)
      externalDatabase = { getConnectionUri: () => externalConnectionUri }
    }
    await applyMigrations(externalConnectionUri)
    return externalDatabase
  }

  container = await new PostgreSqlContainer('postgres:17-alpine')
    .withDatabase('mx_verify')
    .withUsername('mx')
    .withPassword('mx')
    .start()

  const connectionUri = container.getConnectionUri()
  setPostgresEnv(connectionUri)
  await applyMigrations(connectionUri)

  return container
}

export async function stopPgTestContainer() {
  if (!container) {
    externalDatabase = undefined
    migrationsApplied = false
    return
  }

  await container.stop()
  container = undefined
  migrationsApplied = false
}
