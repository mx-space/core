import { UserRound } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.friends.title',
  descriptionKey: 'routes.friends.description',
  icon: UserRound,
  order: 3,
})

export { FriendsRouteView as default } from '~/features/friends/routes/FriendsRouteView'
