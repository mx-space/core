import { Files } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.files.title',
  descriptionKey: 'routes.files.description',
  icon: Files,
  order: 1,
})

export { FilesPage as default } from '~/features/files/routes/FilesRouteViews'
