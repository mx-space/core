import { FolderOpen } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.categories.title',
  descriptionKey: 'routes.categories.description',
  icon: FolderOpen,
  order: 2,
})

export { CategoriesRouteView as default } from '~/features/categories/routes/CategoriesRouteView'
