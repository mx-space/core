import { FileCode2 } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.templates.title',
  descriptionKey: 'routes.templates.description',
  icon: FileCode2,
  order: 2,
})

export { TemplateRouteView as default } from '~/features/templates/routes/TemplateRouteView'
