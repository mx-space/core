import { LayoutGrid } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.aiOverview.title',
  descriptionKey: 'routes.aiOverview.description',
  icon: LayoutGrid,
  order: 0,
})

export { AiOverviewRouteView as default } from '~/features/ai/routes/AiOverviewRouteView'
