import { migration as enrichmentBackfill } from './20260506-enrichment-backfill'
import type { AppMigration } from './types'

/**
 * Ordered list of app-data migrations. Runner sorts by id (lexicographic on
 * the `YYYYMMDD-slug` prefix) before iterating, so insertion order here is
 * not load-bearing — adding a new migration is just `import + push`.
 */
export const migrations: AppMigration[] = [enrichmentBackfill]
