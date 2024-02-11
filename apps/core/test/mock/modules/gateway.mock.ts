import { defineProviders } from 'test/helper/defineProvider'

import { AdminEventsGateway } from '~/processors/gateway/admin/events.gateway'
import { WebEventsGateway } from '~/processors/gateway/web/events.gateway'

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
