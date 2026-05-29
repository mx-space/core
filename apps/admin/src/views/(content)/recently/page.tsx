import { Clock } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.recently.title',
  descriptionKey: 'routes.recently.description',
  icon: Clock,
  order: 6,
})

export { RecentlyRouteView as default } from '~/features/recently/routes/RecentlyRouteView'
