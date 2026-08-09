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

async function realignMigrationTimestamp(
  client: pkg.PoolClient,
  migration: { folderMillis: number; hash: string },
): Promise<void> {
  await client.query(
    `UPDATE "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" SET "created_at" = $1 WHERE "hash" = $2`,
    [migration.folderMillis, migration.hash],
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
 *
 * Idempotency is keyed on each migration's content hash, not Drizzle's single
 * `created_at` watermark — a migration re-tagged by a branch rebase keeps the
 * same hash and is therefore not re-applied.
 */
export async function runSchemaMigrationFiles(
  pool: pkg.Pool,
  migrationsFolder: string,
): Promise<void> {
  const migrations = readMigrationFiles({ migrationsFolder })
  const client = await pool.connect()
  try {
    await ensureMigrationTable(client)
    const result = await client.query<{ hash: string; created_at: string }>(
      `SELECT hash, created_at FROM "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}"`,
    )
    const appliedAtByHash = new Map(
      result.rows.map((row) => [row.hash, row.created_at]),
    )
    const bundledHashes = new Set(migrations.map((migration) => migration.hash))
    const legacyTimestamps = result.rows
      .filter((row) => !bundledHashes.has(row.hash))
      .map((row) => Number(row.created_at))
    const waterline = legacyTimestamps.length
      ? Math.max(...legacyTimestamps)
      : null

    for (const migration of migrations) {
      const appliedAt = appliedAtByHash.get(migration.hash)
      if (appliedAt !== undefined) {
        // A re-tagged migration (branch rebase / renumber) keeps the same hash
        // but gets a fresh journal `when`. Mirror it into the ledger so the
        // boot-time assertSchemaCurrent check does not read the schema behind.
        if (Number(appliedAt) !== migration.folderMillis) {
          await realignMigrationTimestamp(client, migration)
        }
        continue
      }

      // A pre-hash-era (waterline) database may have applied this migration
      // without recording its hash. The waterline is therefore drawn only from
      // ledger rows that match no bundled migration: a row we *can* match by
      // hash is a modern record, and letting it raise the waterline would
      // backfill — and so permanently skip the SQL of — any later migration
      // whose journal `when` happens to be non-monotonic.
      if (waterline !== null && migration.folderMillis <= waterline) {
        await insertMigrationRecord(client, migration)
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
