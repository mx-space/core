import { Pool } from 'pg'

import { startPgTestContainer, stopPgTestContainer } from './pg-testcontainer'

let pool: Pool | undefined

const connect = async () => {
  const container = await startPgTestContainer()
  pool = new Pool({ connectionString: container.getConnectionUri() })
  return pool
}

const closeDatabase = async () => {
  await pool?.end()
  pool = undefined
  await stopPgTestContainer()
}

const clearDatabase = async () => {
  if (!pool) return
  const { rows } = await pool.query(
    `select tablename from pg_tables where schemaname = 'public'`,
  )
  if (rows.length === 0) return
  const tables = rows.map((r: any) => `"${r.tablename}"`).join(', ')
  await pool.query(`truncate table ${tables} restart identity cascade`)
}

export const dbHelper = {
  connect,
  close: closeDatabase,
  clear: clearDatabase,
}
