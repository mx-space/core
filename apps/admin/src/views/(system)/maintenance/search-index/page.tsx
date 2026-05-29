import { SearchCheck } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.searchIndex.title',
  descriptionKey: 'routes.searchIndex.description',
  icon: SearchCheck,
  order: 4,
})

export { SearchIndexRouteView as default } from '~/features/search-index/routes/SearchIndexRouteView'
