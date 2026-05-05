import type pkg from 'pg'

/**
 * Run `fn` while holding a Postgres session-level advisory lock.
 *
 * The lock is bound to the connection; releasing the connection releases the
 * lock implicitly, so the explicit `pg_advisory_unlock` call in `finally` is
 * just hygiene.
 *
 * `lock_timeout` is set on the session so a stuck lock fails fast instead of
 * hanging forever.
 */
export async function withAdvisoryLock<T>(
  pool: pkg.Pool,
  key: bigint,
  fn: () => Promise<T>,
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query(`SET lock_timeout = '60s'`)
    await client.query('SELECT pg_advisory_lock($1)', [key.toString()])
    return await fn()
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [key.toString()])
    } catch (e) {
      console.warn(
        '[advisory-lock] unlock failed (will release on disconnect):',
        e,
      )
    }
    client.release()
  }
}

/**
 * Project-specific advisory lock key for schema migrations.
 *
 * Derived from `sha256("mx-core:schema-migration:v1")`, taking the first 8
 * bytes as a signed bigint. The constant is asserted in tests so that it is
 * only changed deliberately.
 */
export const SCHEMA_MIGRATION_LOCK_KEY = 7607331879281575547n
