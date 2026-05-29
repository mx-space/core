import { Webhook } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.webhooks.title',
  descriptionKey: 'routes.webhooks.description',
  icon: Webhook,
  order: 2,
})

export { WebhooksRouteView as default } from '~/features/webhooks/routes/WebhooksRouteView'
