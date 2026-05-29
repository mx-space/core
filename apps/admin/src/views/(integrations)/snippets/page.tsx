import { SquareFunction } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.snippets.title',
  descriptionKey: 'routes.snippets.description',
  icon: SquareFunction,
  order: 1,
})

export { SnippetsRouteView as default } from '~/features/snippets/routes/SnippetsRouteView'
