import { Hash } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.topics.title',
  descriptionKey: 'routes.topics.description',
  icon: Hash,
  order: 2,
})

export { TopicsRouteView as default } from '~/features/topics/routes/TopicsRouteView'
