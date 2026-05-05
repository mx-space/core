import path from 'node:path'

import { Logger } from '@nestjs/common'
import { sql } from 'drizzle-orm'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import pkg from 'pg'

import { POSTGRES } from '~/app.config'
import { PG_DB_TOKEN, PG_POOL_TOKEN } from '~/constants/system.constant'
import * as schema from '~/database/schema'

const { Pool } = pkg
type PgPool = pkg.Pool

export type DrizzleSchema = typeof schema
export type AppDatabase = NodePgDatabase<DrizzleSchema>

const logger = new Logger('PostgresProvider')

let cachedPool: PgPool | null = null
let cachedDb: AppDatabase | null = null

export const db = new Proxy({} as AppDatabase, {
  get(_target, prop) {
    if (!cachedDb) {
      throw new Error('PostgreSQL db requested before initialization')
    }
    const value = Reflect.get(cachedDb, prop, cachedDb)
    return typeof value === 'function' ? value.bind(cachedDb) : value
  },
})

export async function createPool(): Promise<PgPool> {
  if (cachedPool) return cachedPool
  const pool = new Pool({
    connectionString: POSTGRES.connectionString,
    host: POSTGRES.host,
    port: POSTGRES.port,
    user: POSTGRES.user,
    password: POSTGRES.password,
    database: POSTGRES.database,
    max: POSTGRES.maxPoolSize,
    ssl: POSTGRES.ssl,
  })
  pool.on('error', (err) => {
    logger.error(`PostgreSQL pool error: ${err.message}`, err.stack)
  })
  cachedPool = pool
  return pool
}

export function createDb(pool: PgPool): AppDatabase {
  if (cachedDb) return cachedDb
  cachedDb = drizzle(pool, { schema, casing: 'snake_case' })
  return cachedDb
}

export function resolveMigrationsFolder(): string {
  return process.env.MIGRATIONS_DIR
    ? path.resolve(process.env.MIGRATIONS_DIR)
    : path.resolve(process.cwd(), 'src', 'database', 'migrations')
}

export class SchemaBehindError extends Error {
  constructor(
    public readonly expectedTimestamp: number,
    public readonly actualTimestamp: string | null,
    public readonly expectedHash: string | undefined,
  ) {
    super(
      `Schema is behind. Expected migration timestamp ${expectedTimestamp} ` +
        `(hash=${expectedHash ?? 'n/a'}), database has ` +
        `${actualTimestamp ?? '<none>'}. Run "node migrate.mjs" (or "pnpm -C apps/core migrate") ` +
        `as a release step before starting the app.`,
    )
    this.name = 'SchemaBehindError'
  }
}

export class MigrationDriftError extends Error {
  constructor(
    public readonly timestamp: number,
    public readonly expectedHash: string,
    public readonly actualHash: string,
  ) {
    super(
      `Migration drift detected at timestamp ${timestamp}: bundled hash ` +
        `${expectedHash}, database has ${actualHash}. A migration that was ` +
        `already applied has been edited; this is not safe to recover ` +
        `automatically.`,
    )
    this.name = 'MigrationDriftError'
  }
}

/**
 * Verify that the database is at or beyond the latest bundled migration.
 *
 * Throws `SchemaBehindError` if the database is missing migrations and
 * `MigrationDriftError` if a previously-applied migration's hash differs
 * from what the bundle expects.
 *
 * Schema mutation is the responsibility of the dedicated `migrate.mjs`
 * binary (see `apps/core/src/bin/migrate.ts`); the app refuses to start
 * if the schema is not current.
 */
export async function assertSchemaCurrent(
  db: AppDatabase,
  migrationsFolder: string,
): Promise<void> {
  const files = readMigrationFiles({ migrationsFolder })
  const last = files.at(-1)
  if (!last) return

  const tableExists = await db.execute<{ exists: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'
    ) AS exists
  `)
  if (!tableExists.rows[0]?.exists) {
    throw new SchemaBehindError(last.folderMillis, null, last.hash)
  }

  const result = await db.execute<{ created_at: string; hash: string }>(sql`
    SELECT created_at, hash FROM drizzle.__drizzle_migrations
    ORDER BY created_at DESC LIMIT 1
  `)
  const latest = result.rows[0]
  if (!latest || Number(latest.created_at) < last.folderMillis) {
    throw new SchemaBehindError(
      last.folderMillis,
      latest?.created_at ?? null,
      last.hash,
    )
  }
  if (
    Number(latest.created_at) === last.folderMillis &&
    latest.hash !== last.hash
  ) {
    throw new MigrationDriftError(last.folderMillis, last.hash, latest.hash)
  }
}

export async function disposePool(): Promise<void> {
  if (cachedPool) {
    await cachedPool.end()
    cachedPool = null
    cachedDb = null
  }
}

export const postgresProviders = [
  {
    provide: PG_POOL_TOKEN,
    useFactory: async () => {
      const pool = await createPool()
      const db = createDb(pool)
      await assertSchemaCurrent(db, resolveMigrationsFolder())
      logger.log('Schema verified, postgres pool ready')
      return pool
    },
  },
  {
    provide: PG_DB_TOKEN,
    useFactory: () => {
      if (!cachedPool || !cachedDb) {
        throw new Error(
          'PG_DB_TOKEN requested before PG_POOL_TOKEN was initialized',
        )
      }
      return cachedDb
    },
    inject: [PG_POOL_TOKEN],
  },
]

/**
 * Test-only override. Replaces the cached pool/db instances so test fixtures
 * can point at a per-suite container. Production code should never call this.
 */
export function __setTestPostgresInstance(
  pool: PgPool | null,
  db: AppDatabase | null,
): void {
  cachedPool = pool
  cachedDb = db
}
