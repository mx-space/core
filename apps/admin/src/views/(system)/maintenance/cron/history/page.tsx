import { History } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.cronHistory.title',
  descriptionKey: 'routes.cronHistory.description',
  icon: History,
  order: 1,
})

export { CronHistoryRouteView as default } from '~/features/cron/routes/CronHistoryRouteView'
