import { sql } from 'drizzle-orm'

import type { AppMigration } from './types'

export const migration: AppMigration = {
  id: '20260515-recently-drop-enrichment-columns',
  description:
    'Drop recentlies single-ref enrichment columns; enrichment is attached at read time',
  async up({ db }) {
    await db.execute(sql`
      ALTER TABLE "recentlies"
        DROP COLUMN IF EXISTS "enrichment_provider",
        DROP COLUMN IF EXISTS "enrichment_external_id"
    `)
    await db.execute(
      sql`DROP INDEX IF EXISTS "recentlies_enrichment_idx"`,
    )
  },
}
