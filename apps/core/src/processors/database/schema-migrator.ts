import { readMigrationFiles } from 'drizzle-orm/migrator'
import type pkg from 'pg'

const MIGRATIONS_SCHEMA = 'drizzle'
const MIGRATIONS_TABLE = '__drizzle_migrations'

function isConcurrentIndexStatement(statement: string): boolean {
  return /\b(?:create\s+(?:unique\s+)?index|drop\s+index)\s+concurrently\b/i.test(
    statement,
  )
}

function hasConcurrentIndex(statements: string[]): boolean {
  return statements.some(isConcurrentIndexStatement)
}

async function ensureMigrationTable(client: pkg.PoolClient): Promise<void> {
  await client.query(`CREATE SCHEMA IF NOT EXISTS "${MIGRATIONS_SCHEMA}"`)
  await client.query(`
    CREATE TABLE IF NOT EXISTS "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `)
}

async function runStatementsInTransaction(
  client: pkg.PoolClient,
  statements: string[],
): Promise<void> {
  await client.query('BEGIN')
  try {
    for (const statement of statements) {
      await client.query(statement)
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}

async function insertMigrationRecord(
  client: pkg.PoolClient,
  migration: { folderMillis: number; hash: string },
): Promise<void> {
  await client.query(
    `INSERT INTO "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" ("hash", "created_at") VALUES ($1, $2)`,
    [migration.hash, migration.folderMillis],
  )
}

async function runOrdinaryMigration(
  client: pkg.PoolClient,
  statements: string[],
  migration: { folderMillis: number; hash: string },
): Promise<void> {
  await client.query('BEGIN')
  try {
    for (const statement of statements) {
      await client.query(statement)
    }
    await insertMigrationRecord(client, migration)
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}

async function runMixedConcurrentMigration(
  client: pkg.PoolClient,
  statements: string[],
  migration: { folderMillis: number; hash: string },
): Promise<void> {
  let transactionBatch: string[] = []

  for (const statement of statements) {
    if (!isConcurrentIndexStatement(statement)) {
      transactionBatch.push(statement)
      continue
    }

    if (transactionBatch.length > 0) {
      await runStatementsInTransaction(client, transactionBatch)
      transactionBatch = []
    }

    await client.query(statement)
  }

  await client.query('BEGIN')
  try {
    for (const statement of transactionBatch) {
      await client.query(statement)
    }
    await insertMigrationRecord(client, migration)
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}

/**
 * Apply Drizzle-generated PostgreSQL migrations.
 *
 * Drizzle's node-postgres migrator wraps each pending batch in a transaction.
 * PostgreSQL rejects `CREATE INDEX CONCURRENTLY` in that context, so this
 * runner keeps ordinary migrations transactional and only executes concurrent
 * index creation statements outside a transaction.
 */
export async function runSchemaMigrationFiles(
  pool: pkg.Pool,
  migrationsFolder: string,
): Promise<void> {
  const migrations = readMigrationFiles({ migrationsFolder })
  const client = await pool.connect()
  try {
    await ensureMigrationTable(client)
    const result = await client.query<{ created_at: string }>(
      `SELECT created_at FROM "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" ORDER BY created_at DESC LIMIT 1`,
    )
    const lastDbMigration = result.rows[0]

    for (const migration of migrations) {
      if (
        lastDbMigration &&
        Number(lastDbMigration.created_at) >= migration.folderMillis
      ) {
        continue
      }

      const statements = migration.sql
        .map((statement) => statement.trim())
        .filter(Boolean)

      if (hasConcurrentIndex(statements)) {
        await runMixedConcurrentMigration(client, statements, migration)
      } else {
        await runOrdinaryMigration(client, statements, migration)
      }
    }
  } finally {
    client.release()
  }
}
