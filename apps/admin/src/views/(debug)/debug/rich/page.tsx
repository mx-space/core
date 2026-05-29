import { FileCode2 } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.richLab.title',
  descriptionKey: 'routes.richLab.description',
  icon: FileCode2,
  order: 5,
})

export { RichDebugRouteView as default } from '~/features/debug/routes/RichDebugRouteView'
