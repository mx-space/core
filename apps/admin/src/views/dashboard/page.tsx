import { Gauge } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.dashboard.title',
  descriptionKey: 'routes.dashboard.description',
  icon: Gauge,
  order: 1,
})

export { DashboardRouteView as default } from '~/features/dashboard/routes/DashboardRouteView'
