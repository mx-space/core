import { KeyRound } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.passkeyLab.title',
  descriptionKey: 'routes.passkeyLab.description',
  icon: KeyRound,
  order: 2,
})

export { AuthnDebugRouteView as default } from '~/features/debug/routes/AuthnDebugRouteView'
