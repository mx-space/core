import { Pencil } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.writePost.title',
  descriptionKey: 'routes.writePost.description',
  icon: Pencil,
  order: 1,
})

export { PostWritePage as default } from '~/features/write/routes/WriteRouteViews'
