import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { Pool } from 'pg'

const databaseUrl = process.env.PUSH_RELAY_DATABASE_URL?.trim()
if (!databaseUrl) throw new Error('PUSH_RELAY_DATABASE_URL is required')

const pool = new Pool({ connectionString: databaseUrl })
try {
  const sql = await readFile(
    fileURLToPath(new URL('../migrations/0001_initial.sql', import.meta.url)),
    'utf8',
  )
  await pool.query(sql)
  console.info('Push Relay database migration completed')
} finally {
  await pool.end()
}
