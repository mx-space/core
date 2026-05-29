import { Users } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.readers.title',
  descriptionKey: 'routes.readers.description',
  icon: Users,
  order: 2,
})

export { ReadersRouteView as default } from '~/features/readers/routes/ReadersRouteView'
