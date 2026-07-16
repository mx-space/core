import { MonitorSmartphone } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.companion.title',
  descriptionKey: 'routes.companion.description',
  icon: MonitorSmartphone,
  order: 4,
})

export { CompanionRouteView as default } from '~/features/companion/routes/CompanionRouteView'
