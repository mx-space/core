import { Pencil } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.writePage.title',
  descriptionKey: 'routes.writePage.description',
  icon: Pencil,
  order: 1,
})

export { PageWritePage as default } from '~/features/write/routes/WriteRouteViews'
