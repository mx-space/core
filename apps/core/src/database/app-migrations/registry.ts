import { migration as recentlyDropEnrichmentColumns } from './20260515-recently-drop-enrichment-columns'
import type { AppMigration } from './types'

/**
 * Ordered list of app-data migrations. Runner sorts by id (lexicographic on
 * the `YYYYMMDD-slug` prefix) before iterating, so insertion order here is
 * not load-bearing — adding a new migration is just `import + push`.
 *
 * Migrations removed from this list never re-run; the ledger row of a
 * previously applied one is left in place and simply goes unreferenced.
 */
export const migrations: AppMigration[] = [recentlyDropEnrichmentColumns]
