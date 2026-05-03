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
  await pool.query(`
    do $$
    declare
      r record;
    begin
      for r in (
        select tablename
        from pg_tables
        where schemaname = 'public'
      ) loop
        execute 'truncate table "' || r.tablename || '" restart identity cascade';
      end loop;
    end $$;
  `)
}

export const dbHelper = {
  connect,
  close: closeDatabase,
  clear: clearDatabase,
}
