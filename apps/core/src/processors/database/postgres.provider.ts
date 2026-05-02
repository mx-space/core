import path from 'node:path'

import { Logger } from '@nestjs/common'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { migrate as drizzleMigrate } from 'drizzle-orm/node-postgres/migrator'
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
let migrationsApplied = false

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

export async function applyMigrations(db: AppDatabase): Promise<void> {
  if (migrationsApplied) return
  const migrationsFolder = path.resolve(
    process.cwd(),
    'src',
    'database',
    'migrations',
  )
  await drizzleMigrate(db, { migrationsFolder })
  migrationsApplied = true
  logger.log(`Drizzle migrations applied from ${migrationsFolder}`)
}

export async function disposePool(): Promise<void> {
  if (cachedPool) {
    await cachedPool.end()
    cachedPool = null
    cachedDb = null
  }
  migrationsApplied = false
}

export const postgresProviders = [
  {
    provide: PG_POOL_TOKEN,
    useFactory: async () => {
      const pool = await createPool()
      const db = createDb(pool)
      await applyMigrations(db)
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
  migrationsApplied = false
}
