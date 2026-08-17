import { fileURLToPath } from 'node:url'

import { Pool } from 'pg'

import { applyPushRelayMigrations } from './apply-migrations.js'

const databaseUrl = process.env.PUSH_RELAY_DATABASE_URL?.trim()
if (!databaseUrl) throw new Error('PUSH_RELAY_DATABASE_URL is required')

const migrationsDir = fileURLToPath(new URL('../migrations', import.meta.url))
const pool = new Pool({ connectionString: databaseUrl })
const client = await pool.connect()
try {
  await applyPushRelayMigrations(client, { migrationsDir })
  console.info('Push Relay database migration completed')
} finally {
  client.release()
  await pool.end()
}
