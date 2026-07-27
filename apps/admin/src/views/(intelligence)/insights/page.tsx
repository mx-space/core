import { BarChart3 } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.insights.title',
  descriptionKey: 'routes.insights.description',
  icon: BarChart3,
  order: 2,
})

export { InsightsRouteView as default } from '~/features/insights/routes/InsightsRouteView'
