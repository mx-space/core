import { RadioTower } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.eventLab.title',
  descriptionKey: 'routes.eventLab.description',
  icon: RadioTower,
  order: 3,
})

export { EventsDebugRouteView as default } from '~/features/debug/routes/EventsDebugRouteView'
