import { Image } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.commentImages.title',
  descriptionKey: 'routes.commentImages.description',
  icon: Image,
  order: 2,
})

export { CommentImagesPage as default } from '~/features/files/routes/FilesRouteViews'
