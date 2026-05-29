import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.settings.title',
  hidden: true,
})

export { SettingsRouteView as default } from '~/features/settings/routes/SettingsRouteView'
