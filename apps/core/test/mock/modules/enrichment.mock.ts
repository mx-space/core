import { defineProvider } from 'test/helper/defineProvider'

import { EnrichmentService } from '~/modules/enrichment/enrichment.service'

export const enrichmentProvider = defineProvider({
  provide: EnrichmentService,
  useValue: {
    async attachEnrichments<T extends object>(
      doc: T,
    ): Promise<T & { enrichments: Record<string, unknown> }> {
      return { ...doc, enrichments: {} }
    },
    scheduleDocPrefetch() {
      // no-op in contract tests
    },
    async hydrateUrls() {
      return {}
    },
    async prefetchUrls() {
      // no-op
    },
  },
})
