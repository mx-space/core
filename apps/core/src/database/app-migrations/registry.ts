import { migration as recentlyDropEnrichmentColumns } from './20260515-recently-drop-enrichment-columns'
import { migration as treeContentRevisions } from './20260831-tree-content-revisions'
import { migration as mintLoroBlockIds } from './20261026-mint-loro-block-ids'
import { migration as aiMetricsCoverage } from './20261108-ai-metrics-coverage'
import { migration as canonicalConfig } from './20261109-canonical-config'
import { migration as requiredSecretStorage } from './20261109-required-secret-storage'
import { migration as credentialAccountIds } from './20261113-credential-account-ids'
import type { AppMigration } from './types'

/**
 * Ordered list of app-data migrations. Runner sorts by id (lexicographic on
 * the `YYYYMMDD-slug` prefix) before iterating, so insertion order here is
 * not load-bearing — adding a new migration is just `import + push`.
 *
 * Migrations removed from this list never re-run; the ledger row of a
 * previously applied one is left in place and simply goes unreferenced.
 */
export const migrations: AppMigration[] = [
  recentlyDropEnrichmentColumns,
  treeContentRevisions,
  mintLoroBlockIds,
  aiMetricsCoverage,
  canonicalConfig,
  requiredSecretStorage,
  credentialAccountIds,
]
