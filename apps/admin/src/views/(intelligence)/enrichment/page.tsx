import { DatabaseZap } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.enrichment.title',
  descriptionKey: 'routes.enrichment.description',
  icon: DatabaseZap,
  order: 3,
})

export { EnrichmentRouteView as default } from '~/features/enrichment/routes/EnrichmentRouteView'
