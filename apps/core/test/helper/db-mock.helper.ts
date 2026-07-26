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
  // Every vitest worker truncates the same shared PG. TRUNCATE takes its
  // AccessExclusiveLocks in the order the tables are listed, so an unordered
  // pg_tables scan lets two workers lock the same tables in opposite orders
  // and deadlock (40P01). Sorting gives all workers one global lock order.
  const { rows } = await pool.query(
    `select tablename from pg_tables where schemaname = 'public' order by tablename`,
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
