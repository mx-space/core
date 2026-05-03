import { eq, sql } from 'drizzle-orm'

import { readers } from '~/database/schema'
import {
  applyMigrations,
  createDb,
  createPool,
  disposePool,
} from '~/processors/database/postgres.provider'

export const checkInit = async () => {
  let pool
  try {
    pool = await createPool()
    const db = createDb(pool)
    await applyMigrations(db)
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(readers)
      .where(eq(readers.role, 'owner'))

    const isUserExist = Number(row?.count ?? 0) > 0

    return isUserExist
  } catch (err) {
    await disposePool()
    throw err
  }
}
