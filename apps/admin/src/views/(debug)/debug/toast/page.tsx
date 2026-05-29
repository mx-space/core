import { BellRing } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.toastLab.title',
  descriptionKey: 'routes.toastLab.description',
  icon: BellRing,
  order: 1,
})

export { ToastDebugRouteView as default } from '~/features/debug/routes/ToastDebugRouteView'
