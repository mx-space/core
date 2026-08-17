import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

/** Stable xact lock key for Push Relay schema migrations (`purl`). */
export const PUSH_RELAY_MIGRATION_LOCK_KEY = 0x70_75_72_6c

export type MigrationClient = {
  query: (
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: Array<Record<string, unknown>> }>
}

export const applyPushRelayMigrations = async (
  client: MigrationClient,
  options: { migrationsDir: string },
) => {
  const files = (await readdir(options.migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort()
  const applied: string[] = []
  const skipped: string[] = []
  let begun = false

  try {
    await client.query('BEGIN')
    begun = true
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [
      PUSH_RELAY_MIGRATION_LOCK_KEY,
    ])
    await client.query(`CREATE TABLE IF NOT EXISTS push_relay_schema_migrations (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`)
    const recorded = await client.query(
      'SELECT filename FROM push_relay_schema_migrations',
    )
    const done = new Set(recorded.rows.map((row) => String(row.filename)))

    for (const file of files) {
      if (done.has(file)) {
        skipped.push(file)
        continue
      }
      const sql = await readFile(join(options.migrationsDir, file), 'utf8')
      await client.query(sql)
      await client.query(
        'INSERT INTO push_relay_schema_migrations (filename) VALUES ($1)',
        [file],
      )
      applied.push(file)
    }

    await client.query('COMMIT')
    return { applied, skipped }
  } catch (error) {
    if (begun) {
      try {
        await client.query('ROLLBACK')
      } catch {
        // Keep the original migration failure.
      }
    }
    throw error
  }
}
