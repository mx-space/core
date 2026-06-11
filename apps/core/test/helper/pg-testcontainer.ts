import path from 'node:path'

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql'
import pkg from 'pg'

import { runSchemaMigrationFiles } from '~/processors/database/schema-migrator'

const { Pool } = pkg

interface PgTestDatabase {
  getConnectionUri: () => string
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
    await runSchemaMigrationFiles(pool, migrationsFolder)
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

// In CI every vitest worker shares one external PG (PG_VERIFY_URL), and the
// per-file afterAll in setupFiles/lifecycle.ts truncates ALL public tables.
// Specs that assert cross-statement state on real PG must run in their own
// database or a concurrently finishing file wipes their rows mid-test.
export async function createIsolatedPgDatabase(): Promise<{
  getConnectionUri: () => string
  drop: () => Promise<void>
}> {
  const base = await startPgTestContainer()
  const baseUri = base.getConnectionUri()
  const dbName = `mx_isolated_${process.pid}_${Date.now()}`

  const admin = new Pool({ connectionString: baseUri, max: 1 })
  try {
    await admin.query(`CREATE DATABASE ${dbName}`)
  } finally {
    await admin.end()
  }

  const url = new URL(baseUri)
  url.pathname = `/${dbName}`
  const connectionUri = url.toString()

  const migrationsFolder = path.resolve(
    __dirname,
    '../../src/database/migrations',
  )
  const pool = new Pool({ connectionString: connectionUri, max: 2 })
  try {
    await runSchemaMigrationFiles(pool, migrationsFolder)
  } finally {
    await pool.end()
  }

  return {
    getConnectionUri: () => connectionUri,
    drop: async () => {
      const cleaner = new Pool({ connectionString: baseUri, max: 1 })
      try {
        await cleaner.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`)
      } finally {
        await cleaner.end()
      }
    },
  }
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
