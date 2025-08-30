import { AdminEventsGateway } from '~/processors/gateway/admin/events.gateway'
import { WebEventsGateway } from '~/processors/gateway/web/events.gateway'
import { defineProviders } from 'test/helper/defineProvider'

export const gatewayProviders = defineProviders([
  {
    provide: WebEventsGateway,
    useValue: {},
  },
  {
    provide: AdminEventsGateway,
    useValue: {},
  },
])
