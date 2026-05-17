import { readMigrationFiles } from 'drizzle-orm/migrator'
import type pkg from 'pg'

const MIGRATIONS_SCHEMA = 'drizzle'
const MIGRATIONS_TABLE = '__drizzle_migrations'

function hasConcurrentIndex(statements: string[]): boolean {
  return statements.some((statement) =>
    /\bcreate\s+(?:unique\s+)?index\s+concurrently\b/i.test(statement),
  )
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
  migration: { folderMillis: number; hash: string },
): Promise<void> {
  await client.query('BEGIN')
  try {
    for (const statement of statements) {
      await client.query(statement)
    }
    await client.query(
      `INSERT INTO "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" ("hash", "created_at") VALUES ($1, $2)`,
      [migration.hash, migration.folderMillis],
    )
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}

async function runStatementsWithoutTransaction(
  client: pkg.PoolClient,
  statements: string[],
  migration: { folderMillis: number; hash: string },
): Promise<void> {
  for (const statement of statements) {
    await client.query(statement)
  }
  await client.query(
    `INSERT INTO "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" ("hash", "created_at") VALUES ($1, $2)`,
    [migration.hash, migration.folderMillis],
  )
}

/**
 * Apply Drizzle-generated PostgreSQL migrations.
 *
 * Drizzle's node-postgres migrator wraps each pending batch in a transaction.
 * PostgreSQL rejects `CREATE INDEX CONCURRENTLY` in that context, so this
 * runner keeps ordinary migrations transactional and executes migrations that
 * contain concurrent index creation outside a transaction.
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
        await runStatementsWithoutTransaction(client, statements, migration)
      } else {
        await runStatementsInTransaction(client, statements, migration)
      }
    }
  } finally {
    client.release()
  }
}
