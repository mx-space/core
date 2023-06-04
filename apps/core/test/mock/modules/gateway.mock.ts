import { defineProviders } from 'test/helper/defineProvider'

import { AdminEventsGateway } from '~/processors/gateway/admin/events.gateway'
import { SystemEventsGateway } from '~/processors/gateway/system/events.gateway'
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
  {
    provide: SystemEventsGateway,
    useValue: {},
  },
])
