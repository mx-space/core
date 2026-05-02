import { eq, sql } from 'drizzle-orm'

import { readers } from '~/database/schema'
import { createDb, createPool } from '~/processors/database/postgres.provider'

export const checkInit = async () => {
  const pool = await createPool()
  const db = createDb(pool)
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(readers)
    .where(eq(readers.role, 'owner'))

  const isUserExist = Number(row?.count ?? 0) > 0

  return isUserExist
}
