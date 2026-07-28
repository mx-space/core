import { sql } from 'drizzle-orm'

import type { AppDatabase } from '~/processors/database/postgres.provider'

type AppTransaction = Parameters<Parameters<AppDatabase['transaction']>[0]>[0]

export async function acquireContentFormatTransitionLock(
  tx: AppTransaction,
  input: { refId: string; refType: string },
): Promise<void> {
  const key = `content-format:${input.refType}:${input.refId}`
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`,
  )
}
