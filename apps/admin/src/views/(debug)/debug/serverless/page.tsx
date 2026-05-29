import { Terminal } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.functionLab.title',
  descriptionKey: 'routes.functionLab.description',
  icon: Terminal,
  order: 4,
})

export { ServerlessDebugRouteView as default } from '~/features/debug/routes/ServerlessDebugRouteView'
