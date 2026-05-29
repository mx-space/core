import { MessageSquare } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.comments.title',
  descriptionKey: 'routes.comments.description',
  icon: MessageSquare,
  order: 1,
})

export { CommentsRouteView as default } from '~/features/comments/routes/CommentsRouteView'
