import { Image } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.orphanImages.title',
  descriptionKey: 'routes.orphanImages.description',
  icon: Image,
  order: 1,
})

export { OrphanFilesPage as default } from '~/features/files/routes/FilesRouteViews'
