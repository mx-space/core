import { Telescope } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.aiInsights.title',
  descriptionKey: 'routes.aiInsights.description',
  icon: Telescope,
  order: 2,
})

export { AiInsightsRouteView as default } from '~/features/ai/routes/AiInsightsRouteView'
