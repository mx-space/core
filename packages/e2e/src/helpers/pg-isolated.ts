import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql'
import pkg from 'pg'

const { Pool } = pkg

const migrationsFolder = path.resolve(
  fileURLToPath(import.meta.url),
  '../../../../../apps/core/src/database/migrations',
)

export interface IsolatedPg {
  getConnectionUri: () => string
  drop: () => Promise<void>
}

let sharedBase: { uri: string; stop?: () => Promise<void> } | undefined

async function getOrStartBase(): Promise<{
  uri: string
  stop?: () => Promise<void>
}> {
  if (sharedBase) return sharedBase
  const external = process.env.PG_VERIFY_URL?.trim()
  if (external) {
    sharedBase = { uri: external }
    return sharedBase
  }
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(
    'postgres:17-alpine',
  )
    .withDatabase('mx_verify')
    .withUsername('mx')
    .withPassword('mx')
    .start()
  sharedBase = {
    uri: container.getConnectionUri(),
    stop: () => container.stop().then(() => undefined),
  }
  return sharedBase
}

/**
 * Per-worker isolated PG database that side-steps the apps/core test helper's
 * `applyMigrations` step on the base DB. With a shared base (CI), parallel
 * workers were racing on the Drizzle migrations table and tripping unique-
 * index violations on `__drizzle_migrations_id_seq`. The base is never queried
 * by specs; only the per-worker DB needs migrations.
 */
export async function createIsolatedPgDatabase(): Promise<IsolatedPg> {
  const base = await getOrStartBase()
  const dbName = `mx_iso_${process.pid}_${Date.now()}`
  const admin = new Pool({ connectionString: base.uri, max: 1 })
  try {
    await admin.query(`CREATE DATABASE ${dbName}`)
  } finally {
    await admin.end()
  }

  const url = new URL(base.uri)
  url.pathname = `/${dbName}`
  const connectionUri = url.toString()

  const { runSchemaMigrationFiles } =
    await import('~/processors/database/schema-migrator')
  const pool = new Pool({ connectionString: connectionUri, max: 2 })
  try {
    await runSchemaMigrationFiles(pool, migrationsFolder)
  } finally {
    await pool.end()
  }

  return {
    getConnectionUri: () => connectionUri,
    drop: async () => {
      const cleaner = new Pool({ connectionString: base.uri, max: 1 })
      try {
        await cleaner.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`)
      } finally {
        await cleaner.end()
      }
    },
  }
}
