import { ChartLine } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.analyze.title',
  descriptionKey: 'routes.analyze.description',
  icon: ChartLine,
  order: 2,
})

export { AnalyzeRouteView as default } from '~/features/analyze/routes/AnalyzeRouteView'
