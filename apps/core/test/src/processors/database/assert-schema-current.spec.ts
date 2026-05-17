import path from 'node:path'

import { drizzle } from 'drizzle-orm/node-postgres'
import pkg from 'pg'
import {
  createPgTestDatabase,
  type PgTestDatabase,
} from 'test/helper/pg-verify-url'

import {
  assertSchemaCurrent,
  MigrationDriftError,
  SchemaBehindError,
} from '~/processors/database/postgres.provider'
import { runSchemaMigrationFiles } from '~/processors/database/schema-migrator'

const { Pool } = pkg

const migrationsFolder = path.resolve(
  __dirname,
  '../../../../src/database/migrations',
)

describe('assertSchemaCurrent', () => {
  let context: PgTestDatabase
  let poolMain: pkg.Pool

  beforeAll(async () => {
    context = await createPgTestDatabase('mx_assert_main')
    poolMain = context.pool
  })

  afterAll(async () => {
    if (context) await context.close()
  })

  it('passes when the bundled migrations have been applied', async () => {
    // The global test setup already runs migrations; this should be a no-op
    // that simply returns successfully.
    const db = drizzle(poolMain, { casing: 'snake_case' })
    await expect(
      assertSchemaCurrent(db, migrationsFolder),
    ).resolves.toBeUndefined()
  })

  it('throws SchemaBehindError when the migrations table is missing', async () => {
    // Spin up a fresh database in the same server, no migrations applied.
    const dbName = `mx_assert_${Date.now()}`
    await poolMain.query(`CREATE DATABASE ${dbName}`)
    try {
      const url = new URL(context.connectionString)
      url.pathname = `/${dbName}`
      const fresh = new Pool({ connectionString: url.toString(), max: 1 })
      try {
        const db = drizzle(fresh, { casing: 'snake_case' })
        await expect(
          assertSchemaCurrent(db, migrationsFolder),
        ).rejects.toBeInstanceOf(SchemaBehindError)
      } finally {
        await fresh.end()
      }
    } finally {
      await poolMain.query(`DROP DATABASE ${dbName}`)
    }
  }, 30_000)

  it('throws MigrationDriftError when the latest hash differs', async () => {
    // Apply migrations to a fresh db, then tamper with the recorded hash.
    const dbName = `mx_drift_${Date.now()}`
    await poolMain.query(`CREATE DATABASE ${dbName}`)
    try {
      const url = new URL(context.connectionString)
      url.pathname = `/${dbName}`
      const fresh = new Pool({ connectionString: url.toString(), max: 1 })
      try {
        const db = drizzle(fresh, { casing: 'snake_case' })
        await runSchemaMigrationFiles(fresh, migrationsFolder)

        await fresh.query(
          `UPDATE drizzle.__drizzle_migrations SET hash = 'tampered' WHERE created_at = (SELECT max(created_at) FROM drizzle.__drizzle_migrations)`,
        )

        await expect(
          assertSchemaCurrent(db, migrationsFolder),
        ).rejects.toBeInstanceOf(MigrationDriftError)
      } finally {
        await fresh.end()
      }
    } finally {
      await poolMain.query(`DROP DATABASE ${dbName}`)
    }
  }, 60_000)
})
