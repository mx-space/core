import { Injectable, Logger } from '@nestjs/common'

import type { DataJob } from '../data-jobs.types'

/**
 * Placeholder for the recently enrichment backfill job.
 * Full implementation requires inferProviderFromMetadata and convertLegacyMetadata
 * utilities which depend on the specific legacy metadata shapes in production.
 */
@Injectable()
export class RecentlyEnrichmentBackfillJob implements DataJob {
  readonly id = 'recently-enrichment-backfill-v1'
  readonly description = 'Backfill recently references to enrichment_cache'

  private readonly logger = new Logger(RecentlyEnrichmentBackfillJob.name)

  async run(): Promise<Record<string, any>> {
    let processed = 0
    let skipped = 0
    let errors = 0

    // TODO: Implement with actual DB queries
    // 1. Query recently rows with metadata but no enrichment reference
    // 2. For each row, infer provider from metadata type/url
    // 3. Upsert enrichment_cache
    // 4. Update recently with enrichmentProvider/enrichmentExternalId
    // Use cursor-based pagination to process in batches of 200

    this.logger.log(
      `Backfill complete: ${processed} processed, ${skipped} skipped, ${errors} errors`,
    )
    return { processed, skipped, errors }
  }
}
