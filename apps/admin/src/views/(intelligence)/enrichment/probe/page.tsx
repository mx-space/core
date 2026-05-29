import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  hidden: true,
  nested: true,
})

export { EnrichmentProbeRoute as default } from '~/features/enrichment/components/EnrichmentProbeRoute'
