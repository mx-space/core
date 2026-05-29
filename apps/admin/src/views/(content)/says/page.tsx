import { Quote } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.says.title',
  descriptionKey: 'routes.says.description',
  icon: Quote,
  order: 5,
})

export { SaysRouteView as default } from '~/features/says/routes/SaysRouteView'
