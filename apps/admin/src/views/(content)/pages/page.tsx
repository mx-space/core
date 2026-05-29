import { File } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.pages.title',
  descriptionKey: 'routes.pages.description',
  icon: File,
  order: 4,
})

export { PagesRouteView as default } from '~/features/pages/routes/PagesRouteView'
