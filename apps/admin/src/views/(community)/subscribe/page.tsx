import { BellOff } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.subscribe.title',
  descriptionKey: 'routes.subscribe.description',
  icon: BellOff,
  order: 4,
})

export { SubscribeRouteView as default } from '~/features/subscribe/routes/SubscribeRouteView'
