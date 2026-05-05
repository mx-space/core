import { eq, sql } from 'drizzle-orm'

import { readers } from '~/database/schema'
import {
  assertSchemaCurrent,
  createDb,
  createPool,
  resolveMigrationsFolder,
} from '~/processors/database/postgres.provider'

/**
 * Bootstrap-time check called from `bootstrap.ts` before NestFactory creates
 * the application. We run the schema-version guard here as well, so the
 * resulting `SchemaBehindError` surfaces with a clear message rather than as
 * a confusing "table does not exist" from the readers query that follows.
 */
export const checkInit = async () => {
  const pool = await createPool()
  const db = createDb(pool)

  await assertSchemaCurrent(db, resolveMigrationsFolder())

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(readers)
    .where(eq(readers.role, 'owner'))

  const isUserExist = Number(row?.count ?? 0) > 0

  return isUserExist
}
