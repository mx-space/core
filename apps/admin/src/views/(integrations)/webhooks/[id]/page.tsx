import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  hidden: true,
})

export { WebhookDetailRoute as default } from '~/features/webhooks/components/WebhookDetailRoute'
