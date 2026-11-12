import { and, eq, sql } from 'drizzle-orm'

import { accounts } from '~/database/schema'

import type { AppMigration } from './types'

export const migration: AppMigration = {
  id: '20261113-credential-account-ids',
  description: 'Align password credential account IDs with their linked users',
  async up({ db, logger }) {
    const changed = await db.transaction(async (tx) => {
      // Keep the duplicate check and repair consistent with account writes
      // from replicas still serving the previous release during deployment.
      await tx.execute(sql`LOCK TABLE ${accounts} IN SHARE ROW EXCLUSIVE MODE`)
      const duplicates = await tx
        .select({ userId: accounts.userId })
        .from(accounts)
        .where(eq(accounts.providerId, 'credential'))
        .groupBy(accounts.userId)
        .having(sql`count(*) > 1`)

      if (duplicates.length > 0) {
        throw new Error(
          `Cannot repair account IDs: multiple credential accounts for users ${duplicates.map(({ userId }) => userId).join(', ')}`,
        )
      }

      const repaired = await tx
        .update(accounts)
        .set({ accountId: accounts.userId, updatedAt: new Date() })
        .where(
          and(
            eq(accounts.providerId, 'credential'),
            sql`${accounts.accountId} IS DISTINCT FROM ${accounts.userId}`,
          ),
        )
        .returning({ id: accounts.id })
      return repaired.length
    })
    logger.log(`Repaired ${changed} password credential account IDs`)
  },
}
