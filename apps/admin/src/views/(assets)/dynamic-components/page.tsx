import { Blocks } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.dynamicComponents.title',
  descriptionKey: 'routes.dynamicComponents.description',
  icon: Blocks,
  order: 3,
})

export { DynamicComponentsRouteView as default } from '~/features/dynamic-components/routes/DynamicComponentsRouteView'
