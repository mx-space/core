import { FileText } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.posts.title',
  descriptionKey: 'routes.posts.description',
  icon: FileText,
  order: 1,
})

export { PostsRouteView as default } from '~/features/posts/routes/PostsRouteView'
