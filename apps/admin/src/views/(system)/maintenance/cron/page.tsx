import { ListTodo } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.cron.title',
  descriptionKey: 'routes.cron.description',
  icon: ListTodo,
  order: 1,
})

export { CronRouteView as default } from '~/features/cron/routes/CronRouteView'
