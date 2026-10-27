import { Cloud } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.remoteFiles.title',
  descriptionKey: 'routes.remoteFiles.description',
  icon: Cloud,
  order: 1,
})

export { RemoteFilesPage as default } from '~/features/files/routes/FilesRouteViews'
