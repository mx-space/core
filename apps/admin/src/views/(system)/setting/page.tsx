import { Settings } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.settings.title',
  descriptionKey: 'routes.settings.description',
  icon: Settings,
  order: 3,
})

export { SettingsRouteView as default } from '~/features/settings/routes/SettingsRouteView'
